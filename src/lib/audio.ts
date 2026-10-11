/**
 * Audio playback. Uses the pre-generated MP3s; falls back to the browser's
 * speech synthesis (zh-CN) when a file is missing. One shared <audio>
 * element is reused, which keeps mobile browsers happy after the first tap.
 */
import { audioPath, type Voice } from '../content/audioPaths';
import { lookup, sentences } from '../content';
import { currentSettings } from './settings';

const BASE = import.meta.env.BASE_URL;
let el: HTMLAudioElement | null = null;
let alternateFlip = false;
let currentResolve: (() => void) | null = null;

function player(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

/** Choose a voice according to settings ("alternate" flips each call). */
export function pickVoice(): Voice {
  const pref = currentSettings().voice;
  if (pref === 'f' || pref === 'm') return pref;
  alternateFlip = !alternateFlip;
  return alternateFlip ? 'f' : 'm';
}

export function urlFor(id: string, voice: Voice, slow: boolean): string {
  const hasSlowFile = sentences.has(id);
  return BASE + audioPath(id, voice, slow && hasSlowFile);
}

export interface PlayOptions {
  voice?: Voice;
  slow?: boolean;
}

export function stop(): void {
  if (el) el.pause();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  currentResolve?.();
  currentResolve = null;
}

/** Play an item's audio. Resolves when playback ends (or fails). */
export function play(id: string, opts: PlayOptions = {}): Promise<void> {
  stop();
  const voice = opts.voice ?? pickVoice();
  const slow = opts.slow ?? currentSettings().audioSpeed === 'slow';
  const a = player();
  const src = urlFor(id, voice, slow);
  return new Promise<void>((resolve) => {
    currentResolve = resolve;
    const done = () => {
      a.onended = a.onerror = null;
      if (currentResolve === resolve) currentResolve = null;
      resolve();
    };
    a.onended = done;
    a.onerror = () => {
      a.onended = a.onerror = null;
      const text = lookup(id)?.hanzi;
      if (text) speak(text, { slow, voice }).then(done);
      else done();
    };
    a.src = src;
    // Words have no separate slow file: slow them down instead.
    a.playbackRate = slow && !sentences.has(id) ? 0.7 : 1;
    a.play().catch(() => a.onerror?.(new Event('error')));
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
  for (const id of ids) {
    for (const v of voice ? [voice] : (['f', 'm'] as Voice[])) {
      fetch(urlFor(id, v, false), { priority: 'low' } as RequestInit).catch(() => {});
    }
  }
}

/** Download all audio for a set of items in the background, for offline use. */
export async function prefetchForOffline(ids: string[]): Promise<void> {
  const urls = ids.flatMap((id) => {
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
