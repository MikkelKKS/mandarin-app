import { describe, expect, it } from 'vitest';
import sentences from '../../content/data/sentences.json';
import words from '../../content/data/words.json';

type W = { id: string; hanzi: string; level: number; examples: string[] };
type S = { id: string; hanzi: string; words: string[] };
const ws = words as W[];
const byId = new Map(ws.map((w) => [w.id, w]));
const sById = new Map((sentences as S[]).map((s) => [s.id, s]));
/** Same rule as scripts/build-vocab.ts: course-only words (level 0) count as level 2. */
const levelOf = (id: string) => {
  const l = byId.get(id)?.level ?? 7;
  return l === 0 ? 2 : l;
};
const hardestOther = (s: S, word: string) => Math.max(0, ...s.words.filter((w) => w !== word).map(levelOf));

describe('example sentences (IDEAS #17)', () => {
  const easy = ws.filter((w) => w.level >= 1 && w.level <= 4);

  it('every HSK 1–4 word has one', () => {
    expect(easy.filter((w) => !w.examples.length).map((w) => w.hanzi)).toEqual([]);
  });

  it('never use a word more than two HSK levels above the word, and mostly at most one', () => {
    const tooHard: string[] = [];
    let stretch = 0;
    for (const w of easy)
      for (const id of w.examples) {
        const s = sById.get(id);
        if (!s) continue;
        const h = hardestOther(s, w.id);
        if (h > levelOf(w.id) + 2) tooHard.push(`${w.hanzi}: ${s.hanzi}`);
        if (h > levelOf(w.id) + 1) stretch++;
      }
    expect(tooHard).toEqual([]);
    // The +2 fallback is only for words with nothing easier: a small share.
    expect(stretch).toBeLessThan(easy.length * 0.05);
  });
});
