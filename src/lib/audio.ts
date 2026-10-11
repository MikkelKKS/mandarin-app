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
function textVersion(id: string): string {
  const t = `${AUDIO_FORMAT}:${lookup(id)?.hanzi ?? ''}`;
  let h = 5381;
  for (const ch of t) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

export function urlFor(id: string, voice: Voice, slow: boolean): string {
  const hasSlowFile = sentences.has(id);
  return `${BASE}${audioPath(id, voice, slow && hasSlowFile)}?v=${textVersion(id)}`;
}

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
  const a = new Audio(urlFor(id, voice, slow));
  a.preload = 'auto';
  // Words have no separate slow file: slow them down instead (pitch preserved).
  const rate = slow && !sentences.has(id) ? 0.75 : 1;
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
  el = a;
  return new Promise<void>((resolve) => {
    currentResolve = resolve;
    const done = () => {
      a.onended = a.onerror = null;
      if (currentResolve === resolve) currentResolve = null;
      resolve();
    };
    a.onended = done;
    // Only a real loading error (e.g. file missing) falls back to the browser's voice.
    a.onerror = () => {
      a.onended = a.onerror = null;
      if (el !== a) return done();
      const text = lookup(id)?.hanzi;
      if (text) speak(text, { slow, voice }).then(done);
      else done();
    };
    a.play().catch((e: DOMException) => {
      // AbortError: we moved on to another clip. NotAllowedError: no tap yet. Neither is a missing file.
      if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') done();
    });
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
