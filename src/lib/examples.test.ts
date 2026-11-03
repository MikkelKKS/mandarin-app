import { describe, expect, it } from 'vitest';
import { bestExample, rankExamples, startedWords, unknownIn } from './examples';
import { inContext } from './context';
import type { SentenceRow, VocabData, VocabRow } from './vocabData';

const word: VocabRow = { id: 'w', hanzi: '好', pinyin: 'hǎo', gloss: ['good'], level: 1, order: 1, examples: ['hard', 'mid', 'easy'], azure: true };
const s = (id: string, words: string[], hanzi = '很好。', pinyin = 'Hěn hǎo.'): SentenceRow => ({ id, hanzi, pinyin, english: [id], words, azure: true, course: false });
const data = (known?: string[]): VocabData => ({
  words: [word],
  byId: new Map([['w', word]]),
  sentences: new Map([
    ['hard', s('hard', ['w', 'a', 'b', 'c'])],
    ['mid', s('mid', ['w', 'a', 'k1'])],
    ['easy', s('easy', ['w', 'k1', 'k2'], '我很好。', 'Wǒ hěn hǎo.')],
  ]),
  ...(known && { known: new Set(known) }),
});

describe('example sentences by what you know (IDEAS #18)', () => {
  it('counts the other words you have not started', () => {
    expect(unknownIn(s('x', ['w', 'a', 'a', 'k']), 'w', new Set(['k']))).toBe(1);
    expect(unknownIn(s('x', ['w', 'a']), 'w', undefined)).toBe(0);
  });
  it('shows the easiest example first, keeping the build order without a known set', () => {
    expect(rankExamples(word, data(['k1', 'k2'])).map((x) => x.id)).toEqual(['easy', 'mid', 'hard']);
    expect(rankExamples(word, data()).map((x) => x.id)).toEqual(['hard', 'mid', 'easy']);
  });
  it('leaves the example out when even the easiest has more than two unknown words', () => {
    expect(bestExample(word, data(['k1', 'k2']))?.id).toBe('easy');
    expect(bestExample(word, data([]))?.id).toBe('mid'); // two unknown words: still fine
    expect(bestExample(word, data([]), (x) => x.id === 'hard')).toBeUndefined(); // three: left out
    expect(bestExample(word, data())?.id).toBe('hard');
  });
  it('respects a filter (e.g. only recorded sentences)', () => {
    expect(bestExample(word, data(['k1', 'k2']), (x) => x.id !== 'easy')?.id).toBe('mid');
  });
  it('picks the in-context sentence by what you know too', () => {
    expect(inContext(word, data(['k1', 'k2']), () => true)?.sentence.id).toBe('easy');
  });
  it('treats any card that has been seen as started', () => {
    expect([...startedWords([{ word: 'a', reps: 1, state: 2 }, { word: 'b', reps: 0, state: 0 }, { reps: 3, state: 2 }])]).toEqual(['a']);
  });
});
