/**
 * Tone twins: HSK words that differ from another word only in tones
 * (买 mǎi "to buy" / 卖 mài "to sell"). When a typed answer has every syllable
 * right but a tone wrong, and those tones spell another real word, the
 * feedback names that word; Stats lists the pairs mixed up most.
 */
import { parsePinyin, type Syllable } from './pinyin';
import type { SyllableFeedback } from './pinyinAnswer';

export interface TwinWord {
  id: string;
  hanzi: string;
  pinyin: string;
  order: number;
}

const keyOf = (syls: Array<Pick<Syllable, 'base' | 'tone'>>) => syls.map((s) => `${s.base}${s.tone}`).join(' ');

/** Words by their syllables and tones, e.g. "mai3" → [买]. Sorted by learning order. */
export type TwinIndex = Map<string, TwinWord[]>;

export function twinIndex(words: TwinWord[]): TwinIndex {
  const out: TwinIndex = new Map();
  for (const w of words) {
    const syls = parsePinyin(w.pinyin.replace(/\s+/g, ''));
    if (!syls) continue;
    const k = keyOf(syls);
    const list = out.get(k) ?? [];
    list.push(w);
    out.set(k, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.order - b.order);
  return out;
}

const cache = new WeakMap<object, TwinIndex>();
/** The index for a word list, built once per list. */
export function twinIndexFor(words: TwinWord[]): TwinIndex {
  let idx = cache.get(words);
  if (!idx) cache.set(words, (idx = twinIndex(words)));
  return idx;
}

/** The word you'd have said with these tones, if it's a different HSK word (never one that sounds the same as the answer). */
function lookup(word: { id: string; pinyin: string }, tones: number[], index: TwinIndex): TwinWord | null {
  const syls = parsePinyin(word.pinyin.replace(/\s+/g, ''));
  if (!syls || syls.length !== tones.length) return null;
  if (tones.every((t, i) => t === syls[i].tone)) return null;
  const own = keyOf(syls);
  const k = keyOf(syls.map((s, i) => ({ base: s.base, tone: tones[i] as Syllable['tone'] })));
  if (k === own) return null;
  return (index.get(k) ?? []).find((w) => w.id !== word.id) ?? null;
}

/** From a checked answer: only when every syllable is right and at least one tone is wrong (no missing tones). */
export function toneTwinOf(word: { id: string; pinyin: string }, syllables: SyllableFeedback[] | undefined, index: TwinIndex): TwinWord | null {
  if (!syllables?.length) return null;
  if (!syllables.every((s) => s.status === 'ok' || (s.status === 'wrong-tone' && s.given))) return null;
  if (!syllables.some((s) => s.status === 'wrong-tone')) return null;
  return lookup(
    word,
    syllables.map((s) => (s.status === 'ok' ? (s.tone ?? 0) : (s.given ?? 0))),
    index,
  );
}

export interface TwinPair {
  word: TwinWord;
  twin: TwinWord;
  /** Times the word was answered with the twin's tones. */
  count: number;
  last: number;
}

/**
 * Pairs mixed up in typed word answers, from the review log (`<word id>#…`
 * cards with tones logged), most frequent first.
 */
export function twinPairs(
  logs: Array<{ card?: string; tones?: { expected: string; given: string }; at: number; replaced?: boolean }>,
  words: Map<string, TwinWord>,
  index: TwinIndex,
): TwinPair[] {
  const out = new Map<string, TwinPair>();
  for (const l of logs) {
    if (!l.tones || l.replaced || !l.card?.includes('#')) continue;
    const word = words.get(l.card.slice(0, l.card.indexOf('#')));
    if (!word) continue;
    const given = l.tones.given.split('-').map(Number);
    if (given.some((t) => !(t >= 1 && t <= 5))) continue;
    const twin = lookup(word, given, index);
    if (!twin) continue;
    const k = `${word.id}|${twin.id}`;
    const p = out.get(k) ?? { word, twin, count: 0, last: 0 };
    p.count++;
    p.last = Math.max(p.last, l.at);
    out.set(k, p);
  }
  return [...out.values()].sort((a, b) => b.count - a.count || b.last - a.last);
}
