import { describe, expect, it } from 'vitest';
import { checkPinyinAnswer } from './pinyinAnswer';
import { toneTwinOf, twinIndex, twinPairs, type TwinWord } from './toneTwins';

const words: TwinWord[] = [
  { id: 'mai3', hanzi: '买', pinyin: 'mǎi', order: 1 },
  { id: 'mai4', hanzi: '卖', pinyin: 'mài', order: 2 },
  { id: 'shuijiao', hanzi: '睡觉', pinyin: 'shuìjiào', order: 3 },
  { id: 'shuijiao2', hanzi: '水饺', pinyin: 'shuǐjiǎo', order: 4 },
  { id: 'ta-he', hanzi: '他', pinyin: 'tā', order: 5 },
  { id: 'ta-she', hanzi: '她', pinyin: 'tā', order: 6 },
];
const index = twinIndex(words);
const byId = new Map(words.map((w) => [w.id, w]));

describe('tone twins', () => {
  it('names the word the typed tones spell', () => {
    const r = checkPinyinAnswer('mai4', { pinyin: 'mǎi', hanzi: '买' });
    expect(toneTwinOf(words[0], r.syllables, index)?.hanzi).toBe('卖');
    const r2 = checkPinyinAnswer('shui3jiao3', { pinyin: 'shuìjiào', hanzi: '睡觉' });
    expect(toneTwinOf(words[2], r2.syllables, index)?.hanzi).toBe('水饺');
  });
  it('stays quiet without a real twin, for missing tones or wrong syllables', () => {
    const none = checkPinyinAnswer('mai1', { pinyin: 'mǎi', hanzi: '买' });
    expect(toneTwinOf(words[0], none.syllables, index)).toBeNull();
    const missing = checkPinyinAnswer('mai', { pinyin: 'mǎi', hanzi: '买' });
    expect(toneTwinOf(words[0], missing.syllables, index)).toBeNull();
    const other = checkPinyinAnswer('mei4', { pinyin: 'mǎi', hanzi: '买' });
    expect(toneTwinOf(words[0], other.syllables, index)).toBeNull();
    const right = checkPinyinAnswer('mai3', { pinyin: 'mǎi', hanzi: '买' });
    expect(toneTwinOf(words[0], right.syllables, index)).toBeNull();
  });
  it('never offers a same-sounding word as a twin', () => {
    expect(toneTwinOf(words[4], [{ expected: 'tā', status: 'ok', tone: 1, given: 1 }], index)).toBeNull();
  });
  it('counts mixed-up pairs from the review log', () => {
    const logs = [
      { card: 'mai3#lp', tones: { expected: '3', given: '4' }, at: 1 },
      { card: 'mai3#mp', tones: { expected: '3', given: '4' }, at: 5 },
      { card: 'shuijiao#lp', tones: { expected: '4-4', given: '3-3' }, at: 3 },
      { card: 'shuijiao#lp', tones: { expected: '4-4', given: '3-0' }, at: 4 },
      { card: 'mai3#lp', tones: { expected: '3', given: '1' }, at: 6 },
      { card: 'mai3#lp', tones: { expected: '3', given: '4' }, at: 7, replaced: true },
    ];
    const pairs = twinPairs(logs, byId, index);
    expect(pairs.map((p) => [p.word.hanzi, p.twin.hanzi, p.count])).toEqual([
      ['买', '卖', 2],
      ['睡觉', '水饺', 1],
    ]);
  });
});
