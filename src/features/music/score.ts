/**
 * Colouring lyrics by what you know: lines are split into dictionary words, and
 * each word is checked against what you know and your HSK level. (Ranking songs
 * uses the catalogue's derived data instead: catalogue.ts.)
 */
import { isHanzi } from '../../lib/pinyin';
import { segment, type Dict, type Entry } from '../dictionary/dict';
import { toSimplified } from './match';

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

/** Filler sounds that are everywhere in lyrics and don't need learning. */
const FILLERS = new Set(['啊', '呀', '哦', '喔', '哎', '嗯', '啦', '吧', '呢', '嘛', '哈', '噢', '呵', '哟', '唉', '耶', '咿', '哇', '嘿', '喂', '诶', '哼', '呜']);


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

/** True when the lyrics are mostly Chinese characters (not an English song). */
export function isChineseLyrics(lines: string[]): boolean {
  const text = lines.join('');
  const han = [...text].filter(isHanzi).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return han >= 30 && han > latin;
}
