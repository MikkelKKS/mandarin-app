import { pinyin } from 'pinyin-pro';
import { describe, expect, it } from 'vitest';
import words from '../../content/data/words.json';
import { allGrammarNotes, grammarFor } from './grammar';
import { hanziOnly, toNumeric } from './pinyin';

const list = (Array.isArray(words) ? words : (words as { words: unknown[] }).words) as Array<{ hanzi: string; pinyin: string; numeric: string }>;

describe('grammar notes', () => {
  it('every note belongs to an HSK word, and is found from its characters and pinyin', () => {
    for (const n of allGrammarNotes()) {
      const [hanzi, numeric] = n.key.split('|');
      const w = list.find((x) => x.hanzi === hanzi && x.numeric.replace(/\s+/g, '') === numeric.replace(/\s+/g, ''));
      expect(w, n.key).toBeTruthy();
      expect(grammarFor(w)?.key).toBe(n.key);
    }
    expect(grammarFor({ hanzi: '得', pinyin: 'dé' })).toBeUndefined(); // dé "to get" is a different word from de
  });
  it("examples' pinyin matches their characters (syllable by syllable, tones aside)", () => {
    // pinyin-pro's own guesses that are wrong in these sentences (checked by hand).
    const dictionaryMisses = new Set(['地|de5']);
    const bad: string[] = [];
    for (const n of allGrammarNotes()) {
      if (dictionaryMisses.has(n.key)) continue;
      const chars = [...hanziOnly(n.zh)];
      const ours = toNumeric(n.py.replace(/[^\p{L}\s]/gu, ' ')).replace(/[0-9]/g, ' ').replace(/r\b/g, ' r').split(/\s+/).filter(Boolean);
      const dict = pinyin(chars.join(''), { toneType: 'none', type: 'array' }).map((s) => s.replace('ü', 'v'));
      if (ours.join('') !== dict.join('').replace(/er$/, 'r').replace(/(.)er(?=.)/g, '$1r')) bad.push(`${n.key}: ${ours.join('')} vs ${dict.join('')}`);
    }
    expect(bad).toEqual([]);
  });
});
