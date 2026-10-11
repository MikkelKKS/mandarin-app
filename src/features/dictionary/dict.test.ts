import { describe, expect, it } from 'vitest';
import { cedictPinyin, parseCedict, tonelessKey } from '../../../scripts/build-dictionary';
import { parseDict, search, segment } from './dict';

// A tiny hand-made sample in the CEDICT line format (not real dictionary data).
const SAMPLE = [
  '你好 你好 [ni3 hao3] /hello/hi/',
  '你 你 [ni3] /you/',
  '好 好 [hao3] /good/well/',
  '好 好 [hao4] /to be fond of/',
  '我 我 [wo3] /I/me/',
  '很 很 [hen3] /very/quite/',
  '女 女 [nu:3] /female/woman/',
  '妈 妈 [ma1] /mum/',
  '麻 麻 [ma2] /hemp/',
  '马 马 [ma3] /horse/',
  '骂 骂 [ma4] /to scold/',
  '妈妈 妈妈 [ma1 ma5] /mum/mother/',
  '中国 中国 [Zhong1 guo2] /China/',
  '中国人 中国人 [Zhong1 guo2 ren2] /Chinese person/',
  '人 人 [ren2] /person/people/',
  '舊 旧 [jiu4] /old variant of something/',
].join('\n');

const dict = parseDict(parseCedict(SAMPLE, new Map([['你好', 1], ['你', 1]])).join('\n'));

describe('dictionary build', () => {
  it('converts CEDICT pinyin', () => {
    expect(cedictPinyin('ni3 hao3')).toBe('nǐ hǎo');
    expect(cedictPinyin('nu:3')).toBe('nǚ');
    expect(cedictPinyin('Zhong1 guo2')).toBe('Zhōng guó');
    expect(cedictPinyin('ma1 ma5')).toBe('mā ma');
    expect(tonelessKey('nu:3 ren2')).toBe('nvren');
  });
  it('drops pure variant entries', () => {
    expect(dict.byHanzi.has('旧')).toBe(false);
  });
});

describe('dictionary search', () => {
  it('finds by characters, including longer words that start with them', () => {
    const r = search(dict, '中国');
    expect(r.mode).toBe('words');
    if (r.mode === 'words') expect(r.entries.map((e) => e.hanzi)).toEqual(['中国', '中国人']);
  });
  it('finds by pinyin with or without tones', () => {
    const any = search(dict, 'ma');
    if (any.mode === 'words') expect(any.entries.map((e) => e.hanzi).slice(0, 4).sort()).toEqual(['妈', '马', '骂', '麻'].sort());
    const t3 = search(dict, 'ma3');
    if (t3.mode === 'words') expect(t3.entries[0].hanzi).toBe('马');
    const marked = search(dict, 'mǎ');
    if (marked.mode === 'words') expect(marked.entries[0].hanzi).toBe('马');
    const joined = search(dict, 'nihao');
    if (joined.mode === 'words') expect(joined.entries[0].hanzi).toBe('你好');
    const nv = search(dict, 'nv3');
    if (nv.mode === 'words') expect(nv.entries[0].hanzi).toBe('女');
  });
  it('finds by English', () => {
    const r = search(dict, 'horse');
    if (r.mode === 'words') expect(r.entries[0].hanzi).toBe('马');
    const m = search(dict, 'mother');
    if (m.mode === 'words') expect(m.entries[0].hanzi).toBe('妈妈');
  });
  it('splits a sentence into words', () => {
    const r = search(dict, '我很好，你好！');
    expect(r.mode).toBe('sentence');
    expect(segment(dict, '你好中国人').map((t) => t.text)).toEqual(['你好', '中国人']);
    if (r.mode === 'sentence') expect(r.tokens.filter((t) => t.entries.length).map((t) => t.text)).toEqual(['我', '很', '好', '你好']);
  });
});
