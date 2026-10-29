import { describe, expect, it } from 'vitest';
import type { VocabRow } from '../../lib/vocabData';
import { searchWords } from './WordsView';

const row = (id: string, hanzi: string, pinyin: string, gloss: string, level = 1) => ({ id, hanzi, pinyin, gloss: [gloss], level, order: 0, examples: [], azure: false }) as VocabRow;
const WORDS = [row('a', '学生', 'xuéshēng', 'student'), row('b', '同学', 'tóngxué', 'classmate'), row('c', '学习', 'xuéxí', 'to study', 2), row('d', '女儿', 'nǚ’ér', 'daughter', 3), row('e', '雪', 'xuě', 'snow', 4)];
const ids = (q: string) => searchWords(WORDS, q).map((w) => w.id);

describe('searchWords', () => {
  it('finds characters anywhere in a word, across levels', () => expect(ids('学')).toEqual(['a', 'b', 'c']));
  it('matches pinyin from the start, with or without tones or numbers', () => {
    expect(ids('xue')).toEqual(['a', 'c', 'e']);
    expect(ids('xue2')).toEqual(['a', 'c', 'e']);
    expect(ids('xuéshēng')).toEqual(['a']);
    expect(ids('xue sheng')).toEqual(['a']);
    expect(ids('nver')).toEqual(['d']);
  });
  it('matches English meanings', () => expect(ids('study')).toEqual(['c']));
  it('finds nothing for an empty search', () => expect(ids('  ')).toEqual([]));
});
