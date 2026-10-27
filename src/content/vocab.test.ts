import { describe, expect, it } from 'vitest';
import { classifiersFrom, cleanGlosses, numericToMarks, sentencePinyin, tokenize, wordId } from './vocab';

describe('wordId', () => {
  it('is stable and readable', () => {
    expect(wordId('爸爸', 'ba4 ba5')).toBe(wordId('爸爸', 'ba4 ba5'));
    expect(wordId('爸爸', 'ba4 ba5')).toMatch(/^ba4ba5-[a-z0-9]{5}$/);
  });
  it('tells apart same reading, different characters, and same characters, different reading', () => {
    expect(wordId('是', 'shi4')).not.toBe(wordId('事', 'shi4'));
    expect(wordId('行', 'xing2')).not.toBe(wordId('行', 'hang2'));
  });
  it('normalises ü and case', () => {
    expect(wordId('女', 'nu:3')).toBe(wordId('女', 'nv3'));
    expect(wordId('丹麦', 'Dan1 mai4')).toBe(wordId('丹麦', 'dan1 mai4'));
  });
});

describe('numericToMarks', () => {
  it('converts tone numbers', () => {
    expect(numericToMarks('ni3 hao3')).toBe('nǐ hǎo');
    expect(numericToMarks('ba4 ba5')).toBe('bà ba');
    expect(numericToMarks('nu:3 er2')).toBe('nǚ ér');
    expect(numericToMarks('lv4')).toBe('lǜ');
  });
  it('joins erhua onto the syllable before', () => {
    expect(numericToMarks('yi1 dian3 r5')).toBe('yī diǎnr');
  });
  it('keeps capitals for names', () => {
    expect(numericToMarks('A1 la1 bo2 yu3')).toBe('Ā lā bó yǔ');
  });
});

describe('tokenize', () => {
  const vocab = new Set(['我', '爱', '你', '学习', '学', '习']);
  it('takes the longest match', () => {
    expect(tokenize('我爱学习。', vocab).map((t) => t.text)).toEqual(['我', '爱', '学习', '。']);
  });
  it('marks unknown characters', () => {
    expect(tokenize('我爱猫', vocab).find((t) => t.text === '猫')?.unknown).toBe(true);
  });
});

describe('sentencePinyin', () => {
  it('joins word syllables and converts punctuation', () => {
    expect(sentencePinyin([{ text: '我', pinyin: 'wǒ' }, { text: '学习', pinyin: 'xué xí' }, { text: '。' }])).toBe('Wǒ xuéxí.');
    expect(sentencePinyin([{ text: '你', pinyin: 'nǐ' }, { text: '，' }, { text: '好', pinyin: 'hǎo' }, { text: '！' }])).toBe('Nǐ, hǎo!');
  });
});

describe('CC-CEDICT clean-up', () => {
  const defs = ['father (test)', 'CL:個|个[ge4],位[wei4]', 'variant of 爸[ba4]', 'see 爸爸|爸爸[ba4 ba5]'];
  it('drops classifier notes and cross-references', () => {
    expect(cleanGlosses(defs)).toEqual(['father (test)']);
  });
  it('keeps something when everything is a cross-reference', () => {
    expect(cleanGlosses(['variant of 爸[ba4]'])).toEqual(['variant of 爸[ba4]']);
  });
  it('reads classifiers', () => {
    expect(classifiersFrom(defs)).toEqual(['个', '位']);
  });
});
