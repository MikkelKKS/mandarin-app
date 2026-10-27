/**
 * Pure helpers for the Azure text-to-speech script (scripts/azure-tts.ts):
 * SSML, pronunciation hints, billed-character counting and the monthly quota.
 * Kept separate so they can be unit-tested without calling Azure.
 */
import { pinyin as pinyinPro } from 'pinyin-pro';
import { alignToHanzi, hanziOnly, syllableToNumeric } from '../src/lib/pinyin';

export const VOICES = { f: 'zh-CN-XiaoxiaoNeural', m: 'zh-CN-YunjianNeural' } as const;
export type VoiceKey = keyof typeof VOICES;

/** Free tier: 500,000 billed characters a month. Stop a little before it. */
export const MONTHLY_QUOTA = 500_000;
export const SAFETY_MARGIN = 20_000;

/** Slow versions of sentences: 0.8× speed. */
export const SLOW_RATE = '-20%';

/** How Azure writes a zh-CN pronunciation in `<phoneme alphabet="sapi" ph="…">`. */
export type HintFormat = 'spaced' | 'joined';

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "yin2 hang2" → "yin 2 hang 2" (spaced) or "yin2 hang2" (joined). ü is written v. */
export function sapiPhones(numeric: string[], format: HintFormat): string {
  return numeric.map((s) => (format === 'spaced' ? s.replace(/([1-5])$/, ' $1') : s)).join(' ');
}

/**
 * Tone-number syllables for an item, one per character, from the course or HSK pinyin.
 * Returns null when characters and syllables can't be paired (e.g. 儿化), so no hint is given.
 */
export function expectedSyllables(hanzi: string, pinyin: string): string[] | null {
  const al = alignToHanzi(hanzi, pinyin);
  if (!al || al.syls.some((s) => s.erhua) || al.syls.length !== [...hanziOnly(hanzi)].length) return null;
  return al.syls.map(syllableToNumeric);
}

/** What Azure would most likely say without help: the dictionary reading in context. */
export function defaultSyllables(hanzi: string): string[] {
  const text = hanziOnly(hanzi);
  return (pinyinPro(text, { toneType: 'num', type: 'array', toneSandhi: false, v: true }) as string[]).map((s) =>
    /[1-5]$/.test(s) ? s : `${s.replace(/0$/, '')}5`,
  );
}

/** Same syllable, and the tones differ only by a change Azure makes by itself (一, 不, 3-3 sandhi). */
function sameReading(chars: string[], exp: string[], def: string[], i: number): boolean {
  const e = exp[i].replace(/0$/, '5');
  const d = def[i];
  if (e === d) return true;
  const base = (x: string) => x.slice(0, -1);
  const tone = (x: string) => x.slice(-1);
  if (base(e) !== base(d)) return false;
  if (chars[i] === '一' || chars[i] === '不') return true;
  // 3rd tone before a 3rd tone is spoken as 2nd.
  const next = def[i + 1];
  return tone(d) === '3' && tone(e) === '2' && !!next && tone(next) === '3';
}

/**
 * A pronunciation hint is only added where the expected reading differs from the
 * default one (polyphones like 行 háng, 长 zhǎng, 了 liǎo; neutral tones). Markup is
 * billed, so plain text is used whenever it should already come out right.
 */
export function needsHint(hanzi: string, pinyin: string): string[] | null {
  const exp = expectedSyllables(hanzi, pinyin);
  if (!exp) return null;
  const def = defaultSyllables(hanzi);
  if (def.length !== exp.length) return exp;
  const chars = [...hanziOnly(hanzi)];
  return exp.every((_, i) => sameReading(chars, exp, def, i)) ? null : exp;
}

/** The text inside `<voice>`: what Azure bills. */
export function voiceBody(o: { hanzi: string; hint?: string[] | null; format?: HintFormat; slow?: boolean }): string {
  const text = escapeXml(o.hanzi);
  let body = o.hint ? `<phoneme alphabet="sapi" ph="${sapiPhones(o.hint, o.format ?? 'spaced')}">${text}</phoneme>` : text;
  if (o.slow) body = `<prosody rate="${SLOW_RATE}">${body}</prosody>`;
  return body;
}

export function ssml(voice: VoiceKey, body: string): string {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${VOICES[voice]}">${body}</voice></speak>`;
}

/**
 * Billed characters for a request: everything inside the voice element, markup
 * included (only <speak> and <voice> are free), with each Chinese character counted twice.
 */
export function billedChars(body: string): number {
  let n = 0;
  for (const ch of body) n += /\p{Script=Han}/u.test(ch) ? 2 : 1;
  return n;
}

export interface Usage {
  /** Billed characters per calendar month (UTC), e.g. { "2026-10": 1234 }. */
  months: Record<string, number>;
  /** Hint format Azure accepted, once probed. */
  hintFormat?: HintFormat;
}

export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** Characters left this month before the safety margin. */
export function remaining(usage: Usage, now: Date): number {
  return MONTHLY_QUOTA - SAFETY_MARGIN - (usage.months[monthKey(now)] ?? 0);
}
