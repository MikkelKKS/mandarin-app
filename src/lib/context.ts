/**
 * Words that are only clear in a sentence. Without characters, an isolated
 * shì or de could be any of several words, and a neutral-tone particle (le, ne,
 * ba…) on its own isn't really a word you'd ever hear. For these, listening →
 * meaning and dictation use the word's example sentence instead.
 */
import { alignToHanzi, hanziOnly, markSyllable, parsePinyin } from './pinyin';
import { samePinyin } from './gloss';
import type { SentenceRow, VocabData, VocabRow } from './vocabData';

const flat = (p: string) => p.toLowerCase().replace(/[\s'’-]/g, '');

/** A neutral-tone particle or other single neutral-tone syllable (le, de, ne, ba, ma, a, guo, zhe…). */
export function isNeutralParticle(w: Pick<VocabRow, 'pinyin' | 'hanzi' | 'pos'>): boolean {
  if (w.pos?.includes('particle')) return true;
  const syl = parsePinyin(w.pinyin.replace(/\s+/g, ''), [...w.hanzi].length);
  return !!syl && syl.length === 1 && syl[0].tone === 5;
}

/** Pure: HSK 1–4 words that need a sentence: exact homophones of another HSK 1–4 word, and neutral-tone particles. */
export function contextWords(words: VocabRow[]): Set<string> {
  const early = words.filter((w) => w.level >= 1 && w.level <= 4);
  const count = new Map<string, number>();
  for (const w of early) count.set(flat(w.pinyin), (count.get(flat(w.pinyin)) ?? 0) + 1);
  return new Set(early.filter((w) => (count.get(flat(w.pinyin)) ?? 0) > 1 || isNeutralParticle(w)).map((w) => w.id));
}

const cache = new WeakMap<VocabRow[], Set<string>>();
export function needsContext(word: string, data: VocabData): boolean {
  let set = cache.get(data.words);
  if (!set) cache.set(data.words, (set = contextWords(data.words)));
  return set.has(word);
}

export interface InContext {
  sentence: SentenceRow;
  /** The sentence's pinyin around the word: before, the word itself, after. */
  before: string;
  target: string;
  after: string;
}

/** Pure: the word inside one of its example sentences (with a recording), the shortest that lines up. */
export function inContext(w: VocabRow, data: VocabData, hasAudio: (s: SentenceRow) => boolean): InContext | null {
  const options = w.examples
    .map((id) => data.sentences.get(id))
    .filter((s): s is SentenceRow => !!s && hasAudio(s) && s.hanzi.includes(w.hanzi))
    .sort((a, b) => a.hanzi.length - b.hanzi.length);
  for (const s of options) {
    const al = alignToHanzi(s.hanzi, s.pinyin);
    if (!al) continue;
    const chars = al.chars.join('');
    const at = chars.indexOf(hanziOnly(w.hanzi));
    if (at < 0) continue;
    const n = [...hanziOnly(w.hanzi)].length;
    const sylAt = (i: number) => al.charSyl[i];
    const first = sylAt(at);
    const last = sylAt(at + n - 1);
    const say = (from: number, to: number) => al.syls.slice(from, to).map(markSyllable).join(' ');
    const target = al.syls.slice(first, last + 1).map(markSyllable).join('');
    // The sentence must really say this word here (same pinyin, so 的 de isn't matched inside 目的 mùdì).
    if (!samePinyin(target, w.pinyin)) continue;
    return { sentence: s, before: say(0, first), target, after: say(last + 1, al.syls.length) };
  }
  return null;
}
