import { describe, expect, it } from 'vitest';
import { contextWords, inContext, isNeutralParticle } from './context';
import type { SentenceRow, VocabData, VocabRow } from './vocabData';

const w = (id: string, hanzi: string, pinyin: string, level = 1, extra: Partial<VocabRow> = {}): VocabRow => ({ id, hanzi, pinyin, gloss: [id], level, order: 1, examples: [], azure: true, ...extra });

describe('words that need a sentence', () => {
  it('finds exact homophones and neutral-tone particles in HSK 1–4', () => {
    const words = [w('shi4a', '是', 'shì'), w('shi4b', '事', 'shì', 2), w('shi2', '十', 'shí'), w('le', '了', 'le'), w('ba', '吧', 'ba', 1, { pos: ['particle'] }), w('far', '式', 'shì', 6)];
    expect([...contextWords(words)].sort()).toEqual(['ba', 'le', 'shi4a', 'shi4b']);
    expect(isNeutralParticle(w('ma', '吗', 'ma'))).toBe(true);
    expect(isNeutralParticle(w('hao', '好', 'hǎo'))).toBe(false);
  });
  it('places the word in its example sentence', () => {
    const le = w('le', '了', 'le', 1, { examples: ['s1'] });
    const s: SentenceRow = { id: 's1', hanzi: '我吃了。', pinyin: 'Wǒ chī le.', english: ["I've eaten."], words: [], azure: true, course: false };
    const data: VocabData = { words: [le], byId: new Map([['le', le]]), sentences: new Map([['s1', s]]) };
    expect(inContext(le, data, () => true)).toMatchObject({ before: 'wǒ chī', target: 'le', after: '' });
    expect(inContext(le, data, () => false)).toBeNull();
  });
  it("doesn't match the characters inside another word with a different reading", () => {
    const de = w('de', '的', 'de', 1, { examples: ['s2'] });
    const s: SentenceRow = { id: 's2', hanzi: '目的', pinyin: 'mùdì', english: ['aim'], words: [], azure: true, course: false };
    const data: VocabData = { words: [de], byId: new Map([['de', de]]), sentences: new Map([['s2', s]]) };
    expect(inContext(de, data, () => true)).toBeNull();
  });
});
