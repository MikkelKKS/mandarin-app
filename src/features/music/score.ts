/**
 * How hard are a song's lyrics for you? Lyrics are split into dictionary
 * words, and each word is checked against what you know and your HSK level.
 */
import { isHanzi } from '../../lib/pinyin';
import { segment, type Dict, type Entry } from '../dictionary/dict';

export type TokenStatus = 'known' | 'learning' | 'level' | 'hard' | 'other';
export interface LyricToken {
  text: string;
  entry?: Entry;
  status: TokenStatus;
}

export interface Knowledge {
  known: Set<string>; // hanzi of words in long-term review
  learning: Set<string>; // hanzi of words you've met
  level: number; // HSK level you're working on (1 to 4)
}

export interface SongScore {
  /** Han-character words counted (each occurrence). */
  total: number;
  /** Share of words you know or are learning. */
  knownShare: number;
  /** Share of words that are known, learning, or within your HSK level. */
  fit: number;
  band: 'comfortable' | 'stretch' | 'tough';
  /** Most frequent words you don't know yet. */
  unknown: Array<{ hanzi: string; count: number }>;
  cantonese: boolean;
}

/** Filler sounds that are everywhere in lyrics and don't need learning. */
const FILLERS = new Set(['啊', '呀', '哦', '喔', '哎', '嗯', '啦', '吧', '呢', '嘛', '哈', '噢', '呵', '哟', '唉', '耶', '咿', '哇', '嘿', '喂', '诶', '哼', '呜']);
/** Characters that only show up in written Cantonese. */
const CANTONESE = /[嘅咗唔係佢冇啲嘢咁喺哋嚟乜]/g;

export function toSimplified(text: string, t2s: Record<string, string>): string {
  let out = '';
  for (const c of text) out += t2s[c] ?? c;
  return out;
}

export function tokenize(text: string, dict: Dict, t2s: Record<string, string>, k: Knowledge): LyricToken[] {
  return segment(dict, toSimplified(text, t2s)).map(({ text: t, entries }) => {
    if (![...t].some(isHanzi)) return { text: t, status: 'other' as const };
    const entry = entries[0];
    let status: TokenStatus;
    if (FILLERS.has(t) || [...t].every((c) => FILLERS.has(c)) || k.known.has(t)) status = 'known';
    else if (k.learning.has(t)) status = 'learning';
    else if (entries.some((e) => e.hsk > 0 && e.hsk <= Math.min(k.level, 3))) status = 'level';
    else status = 'hard';
    return { text: t, entry, status };
  });
}

export function scoreLyrics(lines: string[], dict: Dict, t2s: Record<string, string>, k: Knowledge): SongScore {
  const text = lines.join('\n');
  const cantonese = (text.match(CANTONESE) ?? []).length >= 3;
  const counts = { known: 0, learning: 0, level: 0, hard: 0 };
  const unknown = new Map<string, number>();
  for (const line of lines) {
    for (const tok of tokenize(line, dict, t2s, k)) {
      if (tok.status === 'other') continue;
      counts[tok.status]++;
      if (tok.status === 'level' || tok.status === 'hard') unknown.set(tok.text, (unknown.get(tok.text) ?? 0) + 1);
    }
  }
  const total = counts.known + counts.learning + counts.level + counts.hard;
  const knownShare = total ? (counts.known + counts.learning) / total : 0;
  const fit = total ? (counts.known + counts.learning + counts.level) / total : 0;
  return {
    total,
    knownShare,
    fit,
    band: fit >= 0.8 ? 'comfortable' : fit >= 0.6 ? 'stretch' : 'tough',
    unknown: [...unknown.entries()]
      .map(([hanzi, count]) => ({ hanzi, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    cantonese,
  };
}

/** True when the lyrics are mostly Chinese characters (not an English song). */
export function isChineseLyrics(lines: string[]): boolean {
  const text = lines.join('');
  const han = [...text].filter(isHanzi).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return han >= 30 && han > latin;
}
