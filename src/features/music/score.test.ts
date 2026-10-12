import { describe, expect, it } from 'vitest';
import { parseDict } from '../dictionary/dict';
import { cleanTitle, parseLrc } from './lyrics';
import { isChineseLyrics, scoreLyrics, toSimplified } from './score';

// A tiny made-up dictionary: hanzi, pinyin, key, defs, hsk.
const dict = parseDict(
  [
    ['我', 'wǒ', 'wo', 'I', '1'],
    ['爱', 'ài', 'ai', 'love', '1'],
    ['你', 'nǐ', 'ni', 'you', '1'],
    ['月亮', 'yuè liang', 'yueliang', 'moon', '3'],
    ['思念', 'sī niàn', 'sinian', 'to miss', '5'],
    ['的', 'de', 'de', 'of', '1'],
    ['心', 'xīn', 'xin', 'heart', '0'],
  ]
    .map((r) => r.join('\t'))
    .join('\n'),
);
const t2s = { 愛: '爱', 離: '离' };

describe('song scoring', () => {
  it('rates words as known, learning, within level or hard', () => {
    const k = { known: new Set(['我', '你']), learning: new Set(['爱']), level: 2 };
    const s = scoreLyrics(['我爱你 啊', '月亮的心 思念'], dict, t2s, k);
    // 我 你 啊 known, 爱 learning, 的 within HSK 2, 月亮 (HSK 3), 心 and 思念 hard
    expect(s.total).toBe(8);
    expect(s.knownShare).toBeCloseTo(4 / 8);
    expect(s.fit).toBeCloseTo(5 / 8);
    expect(s.band).toBe('stretch');
    expect(s.unknown.map((u) => u.hanzi)).toContain('思念');
  });
  it('reads traditional characters', () => {
    expect(toSimplified('我愛你', t2s)).toBe('我爱你');
    const s = scoreLyrics(['我愛你'], dict, t2s, { known: new Set(['我', '爱', '你']), learning: new Set(), level: 1 });
    expect(s.knownShare).toBe(1);
  });
  it('spots Cantonese and English lyrics', () => {
    expect(scoreLyrics(['我係你嘅 佢唔知'], dict, t2s, { known: new Set(), learning: new Set(), level: 1 }).cantonese).toBe(true);
    expect(isChineseLyrics(['I love you so much, baby', '我爱你'])).toBe(false);
  });
});

describe('lyrics helpers', () => {
  it('parses timed lyrics', () => {
    expect(parseLrc('[00:12.50] 第一句\n[01:02.00][01:30.00]副歌')).toEqual([
      { t: 12500, text: '第一句' },
      { t: 62000, text: '副歌' },
      { t: 90000, text: '副歌' },
    ]);
  });
  it('cleans song titles for matching', () => {
    expect(cleanTitle('晴天 (Live)')).toBe('晴天');
    expect(cleanTitle('Song - Remastered 2011')).toBe('Song');
  });
});
