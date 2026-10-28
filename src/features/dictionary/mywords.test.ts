import { describe, expect, it } from 'vitest';
import type { VocabRow } from '../../lib/vocabData';
import { matchHsk } from './mywords';

const row = (id: string, hanzi: string, pinyin: string): VocabRow => ({ id, hanzi, pinyin, gloss: [], level: 1, order: 1, examples: [], azure: true });
const vocab = [row('hang2', '行', 'háng'), row('xing2', '行', 'xíng'), row('nihao', '你好', 'nǐ hǎo')];

describe('learn next: matching a dictionary entry to an HSK word', () => {
  it('matches by characters, and by pinyin when the characters have several readings', () => {
    expect(matchHsk(vocab, { hanzi: '你好', pinyin: 'nǐhǎo' })?.id).toBe('nihao');
    expect(matchHsk(vocab, { hanzi: '行', pinyin: 'xíng' })?.id).toBe('xing2');
    expect(matchHsk(vocab, { hanzi: '行', pinyin: 'háng' })?.id).toBe('hang2');
  });
  it('finds nothing for words outside the HSK list', () => {
    expect(matchHsk(vocab, { hanzi: '奥胡斯', pinyin: 'Àohúsī' })).toBeUndefined();
  });
});
