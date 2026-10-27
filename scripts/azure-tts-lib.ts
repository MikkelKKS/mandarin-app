/**
 * Pure helpers for the Azure text-to-speech script (scripts/azure-tts.ts):
 * SSML, pronunciation hints, billed-character counting and the monthly quota.
 * Kept separate so they can be unit-tested without calling Azure.
 */
import { pinyin as pinyinPro } from 'pinyin-pro';
import { alignToHanzi, hanziOnly, isHanzi, parsePinyin, syllableToNumeric } from '../src/lib/pinyin';

/** Female and male voice. Yunxi replaced Yunjian, which mispronounced too many sentences (owner, 27 Oct). */
export const VOICES = { f: 'zh-CN-XiaoxiaoNeural', m: 'zh-CN-YunxiNeural' } as const;
export type VoiceKey = keyof typeof VOICES;

/** Free tier: 500,000 billed characters a month. Stop a little before it. */
export const MONTHLY_QUOTA = 500_000;
export const SAFETY_MARGIN = 20_000;

/** Slow versions of sentences: 0.7× speed (the owner found 0.8× not slow enough). */
export const SLOW_RATE = '-30%';

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

/** A stretch of the text that gets a pronunciation hint: character positions [start, end) and its syllables. */
export interface HintSpan {
  start: number;
  end: number;
  phones: string[];
}

/** How many syllables each space-separated pinyin word has ("Nǐ míngtiān yǒu" → [1, 2, 1]). */
function wordSizes(pinyin: string, total: number): number[] {
  const sizes = pinyin
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}']/gu, ''))
    .filter(Boolean)
    .map((w) => parsePinyin(w)?.length ?? 0);
  return sizes.reduce((a, b) => a + b, 0) === total && sizes.every((n) => n > 0) ? sizes : Array(total).fill(1);
}

/**
 * Pronunciation hints, only where the expected reading differs from the default one
 * (polyphones like 行 háng, 长 zhǎng, 空 kòng, 还 huán; neutral tones in single words),
 * and only around the word concerned. Hinting a whole sentence makes Azure read it
 * syllable by syllable and lose its melody, and markup is billed too.
 */
export function hintSpans(hanzi: string, pinyin: string, opts: { all?: boolean } = {}): HintSpan[] {
  const exp = expectedSyllables(hanzi, pinyin);
  if (!exp) return [];
  const def = defaultSyllables(hanzi);
  if (def.length !== exp.length) return [];
  const han = [...hanziOnly(hanzi)];
  const sizes = wordSizes(pinyin, exp.length);
  const isSentence = sizes.length > 1;
  // Position of each Chinese character in the full text (with punctuation).
  const pos: number[] = [];
  [...hanzi].forEach((c, i) => isHanzi(c) && pos.push(i));
  const spans: HintSpan[] = [];
  let at = 0;
  for (const n of sizes) {
    const idx = Array.from({ length: n }, (_, k) => at + k);
    at += n;
    // `all`: spell out every word (used when a recording was reported as wrong).
    const off = opts.all ? idx : idx.filter((i) => !sameReading(han, exp, def, i));
    // In a sentence, a neutral tone alone isn't worth a hint: context gets those right.
    const real = isSentence && !opts.all ? off.filter((i) => exp[i].slice(0, -1) !== def[i].slice(0, -1) || !exp[i].endsWith('5')) : off;
    if (!real.length) continue;
    spans.push({ start: pos[idx[0]], end: pos[idx[n - 1]] + 1, phones: idx.map((i) => exp[i]) });
  }
  return spans;
}

/** The text inside `<voice>`: what Azure bills. */
export function voiceBody(o: { hanzi: string; hints?: HintSpan[]; format?: HintFormat; slow?: boolean }): string {
  const chars = [...o.hanzi];
  let body = '';
  let i = 0;
  for (const h of [...(o.hints ?? [])].sort((a, b) => a.start - b.start)) {
    body += escapeXml(chars.slice(i, h.start).join(''));
    body += `<phoneme alphabet="sapi" ph="${sapiPhones(h.phones, o.format ?? 'spaced')}">${escapeXml(chars.slice(h.start, h.end).join(''))}</phoneme>`;
    i = h.end;
  }
  body += escapeXml(chars.slice(i).join(''));
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
