import { pinyin } from 'pinyin-pro';
import { describe, expect, it } from 'vitest';
import gen from '../../content/generated-sentences.json';
import { hanziOnly, toNumeric } from '../lib/pinyin';

/** Sentences where pinyin-pro's own reading of a character is wrong in context (checked by hand). */
const DICTIONARY_MISSES = new Set<string>([
  'chong2-drorj', // 重写 chóng
  'tiao2-6yyx1', // 空调 kōngtiáo, 调高 tiáo
  'jia1kuai4-gugsb', // 得 děi (must)
  'ji4-j4wh1', // 系好 jì
  'shang1wu4-2x18c', // 参加 cānjiā
  'shuai4xian1-608d9', // 率先 shuài
  'dao4che1-i2uwa', // 慢慢地 de
  'ai3xiao3-wrv9r', // 长得 zhǎng
]);

describe('generated example sentences', () => {
  it("pinyin matches the characters, syllable by syllable (tones aside)", () => {
    const bad: string[] = [];
    for (const g of gen.sentences) {
      if (DICTIONARY_MISSES.has(g.word)) continue;
      const chars = [...hanziOnly(g.zh)];
      const ours = toNumeric(g.py.replace(/[^\p{L}\s']/gu, ' ').replace(/'/g, ' ')).replace(/[0-9]/g, ' ').split(/\s+/).filter(Boolean).join('');
      const dict = pinyin(chars.join(''), { toneType: 'none', type: 'array' }).map((s) => s.replace('ü', 'v')).join('');
      // Erhua: 儿 is written as a final r.
      if (ours !== dict && ours !== dict.replace(/er(?=[a-z]*$)|er/g, (m, i) => (i === 0 ? m : 'r'))) bad.push(`${g.word}: ${ours} vs ${dict}`);
    }
    expect(bad).toEqual([]);
  });
  it('never uses 您 except for the word 您 itself', () => {
    expect(gen.sentences.filter((g) => g.zh.includes('您') && g.word !== 'nin2-32af0').map((g) => g.zh)).toEqual([]);
  });
});
