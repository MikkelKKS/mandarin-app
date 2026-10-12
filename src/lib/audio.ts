/**
 * Audio playback. Uses the pre-generated MP3s; falls back to the browser's
 * speech synthesis (zh-CN) only when a file is genuinely missing. Each clip
 * gets a fresh <audio> element: swapping the source of a playing element
 * caused glitches in Firefox.
 */
import { audioPath, type Voice } from '../content/audioPaths';
import { lookup, sentences } from '../content';
import { currentSettings } from './settings';

const BASE = import.meta.env.BASE_URL;
let el: HTMLAudioElement | null = null;
let alternateFlip = false;
let currentResolve: (() => void) | null = null;

/** Choose a voice according to settings ("alternate" flips each call). */
export function pickVoice(): Voice {
  const pref = currentSettings().voice;
  if (pref === 'f' || pref === 'm') return pref;
  alternateFlip = !alternateFlip;
  return alternateFlip ? 'f' : 'm';
}

/** Short hash of the spoken text, so edited items get fresh audio past any cache. */
const AUDIO_FORMAT = 2; // matches scripts/generate-audio.py (2 = padded with silence)
/** Bump to make every device fetch fresh audio (r1: replaced recordings that were cut off). */
const REFRESH = 'r1';
function textVersion(id: string): string {
  const t = `${AUDIO_FORMAT}${REFRESH}:${lookup(id)?.hanzi ?? ''}`;
  let h = 5381;
  for (const ch of t) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

const SLOW_VERSION = 2; // matches SLOW_VERSION in scripts/generate-audio.py

export function urlFor(id: string, voice: Voice, slow: boolean): string {
  const slowFile = slow && sentences.has(id);
  return `${BASE}${audioPath(id, voice, slowFile)}?v=${textVersion(id)}${slowFile ? `s${SLOW_VERSION}` : ''}`;
}

/** Extra slow-down for the turtle button (the slow recordings are already 25% slower). */
const SLOW_SENTENCE_RATE = 0.8;
const SLOW_WORD_RATE = 0.65;

/** Recordings that turned out not to exist (this session), so they aren't tried again. */
const missing = new Set<string>();

export interface PlayOptions {
  voice?: Voice;
  slow?: boolean;
}

export function stop(): void {
  if (el) {
    el.onended = el.onerror = null;
    el.pause();
    el.removeAttribute('src');
    el = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  currentResolve?.();
  currentResolve = null;
}

/** Play an item's audio. Resolves when playback ends (or fails). */
export function play(id: string, opts: PlayOptions = {}): Promise<void> {
  stop();
  const voice = opts.voice ?? pickVoice();
  const slow = opts.slow ?? currentSettings().audioSpeed === 'slow';
  if (id.startsWith('p-')) {
    // Practice-pack items have no recordings: use the browser's voice.
    const text = lookup(id)?.hanzi;
    return text ? speak(text, { slow, voice }) : Promise.resolve();
  }
  // Recordings to try in order: the chosen voice, then the other voice, then normal speed
  // slowed down. Only when none exists does the browser's own voice take over.
  const other: Voice = voice === 'f' ? 'm' : 'f';
  const isSentence = sentences.has(id);
  const tries: Array<{ url: string; rate: number }> = [];
  const add = (v: Voice, slowFile: boolean, rate: number) => {
    const url = urlFor(id, v, slowFile);
    if (!missing.has(url) && !tries.some((t) => t.url === url)) tries.push({ url, rate });
  };
  // Turtle speed: sentences use their slow recording, slowed a bit more; words have no slow
  // recording, so they're slowed down further. Pitch is preserved either way.
  const rate = !slow ? 1 : isSentence ? SLOW_SENTENCE_RATE : SLOW_WORD_RATE;
  add(voice, slow, rate);
  add(other, slow, rate);
  if (slow && isSentence) {
    add(voice, false, SLOW_WORD_RATE);
    add(other, false, SLOW_WORD_RATE);
  }
  return new Promise<void>((resolve) => {
    currentResolve = resolve;
    let a: HTMLAudioElement | null = null;
    const done = () => {
      if (a) a.onended = a.onerror = null;
      if (currentResolve === resolve) currentResolve = null;
      resolve();
    };
    const attempt = (i: number) => {
      if (i >= tries.length) {
        const text = lookup(id)?.hanzi;
        if (text && currentResolve === resolve) speak(text, { slow, voice }).then(done);
        else done();
        return;
      }
      const t = tries[i];
      a = new Audio(t.url);
      a.preload = 'auto';
      a.defaultPlaybackRate = t.rate;
      a.playbackRate = t.rate;
      el = a;
      const me = a;
      me.onended = done;
      // Only a real loading error (file missing) moves on to the next option.
      me.onerror = () => {
        me.onended = me.onerror = null;
        if (el !== me) return done();
        missing.add(t.url);
        attempt(i + 1);
      };
      me.play().catch((e: DOMException) => {
        // AbortError: we moved on to another clip. NotAllowedError: no tap yet. Neither is a missing file.
        if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') done();
      });
    };
    attempt(0);
  });
}

/** Browser text-to-speech fallback (also used for imported practice packs). */
export function speak(text: string, opts: PlayOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = opts.slow ? 0.6 : 0.9;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('zh-CN'));
    if (voices.length) u.voice = voices[opts.voice === 'm' ? voices.length - 1 : 0];
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

/** Warm the cache for upcoming audio (goes through the service worker cache). */
export function preload(ids: string[], voice?: Voice): void {
  for (const id of ids.filter((i) => !i.startsWith('p-'))) {
    for (const v of voice ? [voice] : (['f', 'm'] as Voice[])) {
      fetch(urlFor(id, v, false), { priority: 'low' } as RequestInit).catch(() => {});
    }
  }
}

/** Download all audio for a set of items in the background, for offline use. */
export async function prefetchForOffline(ids: string[]): Promise<void> {
  const urls = ids.filter((i) => !i.startsWith('p-')).flatMap((id) => {
    const list = [urlFor(id, 'f', false), urlFor(id, 'm', false)];
    if (sentences.has(id)) list.push(urlFor(id, 'f', true), urlFor(id, 'm', true));
    return list;
  });
  const cache = typeof caches !== 'undefined' ? await caches.open('audio') : null;
  for (const url of urls) {
    try {
      if (cache && (await cache.match(url))) continue;
      await fetch(url, { priority: 'low' } as RequestInit);
    } catch {
      return; // offline: try again another time
    }
  }
}

/** URL of the pre-recorded dictionary clip for an HSK 1-6 word. */
export function dictAudioUrl(hanzi: string): string {
  const key = [...hanzi].map((c) => c.codePointAt(0)!.toString(16)).join('_');
  return `${BASE}audio/dict/${key}.mp3?v=${AUDIO_FORMAT}${REFRESH}`;
}

/** Play a URL; resolves true if it played, false if it failed to load. */
export function playUrl(url: string): Promise<boolean> {
  stop();
  const a = new Audio(url);
  el = a;
  return new Promise((resolve) => {
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch((e: DOMException) => resolve(e?.name === 'AbortError'));
  });
}

/** Does this browser have a Chinese text-to-speech voice? (Firefox on Windows often doesn't.) */
export function hasChineseVoice(): Promise<boolean> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve(false);
  const check = () => speechSynthesis.getVoices().some((v) => v.lang.replace('_', '-').toLowerCase().startsWith('zh'));
  if (speechSynthesis.getVoices().length) return Promise.resolve(check());
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(check()), 1200);
    speechSynthesis.addEventListener('voiceschanged', () => {
      clearTimeout(t);
      resolve(check());
    }, { once: true });
  });
}
