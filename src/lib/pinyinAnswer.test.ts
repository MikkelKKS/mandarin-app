import { describe, expect, it } from 'vitest';
import { checkPinyinAnswer as check } from './pinyinAnswer';
import { markSyllable, parsePinyin, toNumeric } from './pinyin';

const nihao = { hanzi: '你好', pinyin: 'nǐ hǎo' };

describe('pinyin utilities', () => {
  it('parses joined pinyin with tone marks', () => {
    expect(parsePinyin('wǒmen')).toEqual([
      { base: 'wo', tone: 3 },
      { base: 'men', tone: 5 },
    ]);
  });
  it('uses the expected syllable count to resolve ambiguity', () => {
    expect(parsePinyin("Xī'ān", 2)?.map((s) => s.base)).toEqual(['xi', 'an']);
    expect(parsePinyin('xiān', 1)?.map((s) => s.base)).toEqual(['xian']);
  });
  it('places tone marks correctly', () => {
    expect(markSyllable({ base: 'hao', tone: 3 })).toBe('hǎo');
    expect(markSyllable({ base: 'dou', tone: 1 })).toBe('dōu');
    expect(markSyllable({ base: 'gui', tone: 4 })).toBe('guì');
    expect(markSyllable({ base: 'liu', tone: 2 })).toBe('liú');
    expect(markSyllable({ base: 'nv', tone: 3 })).toBe('nǚ');
    expect(markSyllable({ base: 'lve', tone: 4 })).toBe('lüè');
    expect(markSyllable({ base: 'ma', tone: 5 })).toBe('ma');
  });
  it('converts to tone numbers', () => {
    expect(toNumeric('nǐ hǎo')).toBe('ni3 hao3');
    expect(toNumeric('xièxie')).toBe('xie4xie5');
    expect(toNumeric('nǚ')).toBe('nv3');
  });
});

describe('checkPinyinAnswer', () => {
  it('accepts tone marks, numbers, spacing and case variants', () => {
    for (const input of ['nǐ hǎo', 'ni3 hao3', 'ni3hao3', 'NI3 HAO3', 'Nǐhǎo!', '  ni3   hao3 ', 'nǐ, hǎo.']) {
      expect(check(input, nihao).verdict, input).toBe('correct');
    }
  });

  it('accepts v, u: and ü for ü', () => {
    const nv = { hanzi: '女', pinyin: 'nǚ' };
    for (const input of ['nv3', 'nu:3', 'nü3', 'nǚ', 'NV3']) {
      expect(check(input, nv).verdict, input).toBe('correct');
    }
    expect(check('nu3', nv).verdict).toBe('wrong');
  });

  it('handles the neutral tone (5, 0 or nothing)', () => {
    const xx = { hanzi: '谢谢', pinyin: 'xièxie' };
    for (const input of ['xie4xie', 'xie4xie5', 'xie4xie0', 'xièxie']) {
      expect(check(input, xx).verdict, input).toBe('correct');
    }
    // the citation tone of a neutral syllable is tolerated
    expect(check('xie4xie4', xx).verdict).toBe('correct');
    expect(check('xie4xie2', xx).verdict).toBe('wrong');
  });

  it('marks missing tones as almost (lenient) or wrong (strict)', () => {
    const r = check('ni hao', nihao);
    expect(r.verdict).toBe('almost');
    expect(r.reason).toBe('missing-tones');
    expect(r.syllables?.map((s) => s.status)).toEqual(['missing', 'missing']);
    expect(check('ni3 hao', nihao).verdict).toBe('almost');
    expect(check('ni hao', nihao, { strictTones: true }).verdict).toBe('wrong');
  });

  it('rejects wrong tones and reports which syllable', () => {
    const r = check('ni3 hao4', nihao);
    expect(r.verdict).toBe('wrong');
    expect(r.reason).toBe('wrong-tones');
    expect(r.syllables?.map((s) => s.status)).toEqual(['ok', 'wrong-tone']);
  });

  it('applies third-tone sandhi leniency', () => {
    expect(check('ni2 hao3', nihao).verdict).toBe('correct');
    expect(check('ni3 hao2', nihao).verdict).toBe('wrong');
  });

  it('applies 不 and 一 leniency', () => {
    const bushi = { hanzi: '不是', pinyin: 'bú shì' };
    expect(check('bu2 shi4', bushi).verdict).toBe('correct');
    expect(check('bu4 shi4', bushi).verdict).toBe('correct');
    expect(check('bu3 shi4', bushi).verdict).toBe('wrong');
    const yige = { hanzi: '一个', pinyin: 'yí gè' };
    for (const input of ['yi2 ge4', 'yi1 ge4', 'yi4 ge4']) {
      expect(check(input, yige).verdict, input).toBe('correct');
    }
    expect(check('yi3 ge4', yige).verdict).toBe('wrong');
  });

  it('gives a typo pass for a one-letter slip on long answers only', () => {
    const long = { hanzi: '我很高兴认识你', pinyin: 'wǒ hěn gāoxìng rènshi nǐ' };
    const r = check('wo3 hen3 gaoxing4 renshi ni3'.replace('gaoxing4', 'gaoxin4'), long);
    expect(r.verdict).toBe('typo');
    expect(r.correction).toBe('wǒ hěn gāoxìng rènshi nǐ');
    expect(check('ni3 hap3', nihao).verdict).toBe('wrong');
    expect(check('wo3 hen3 gao1xing4 ren4shi ni3', long).verdict).toBe('correct');
  });

  it('accepts listed alternatives', () => {
    const exp = { hanzi: '你叫什么名字', pinyin: 'nǐ jiào shénme míngzi' };
    const alt = { hanzi: '你叫什么', pinyin: 'nǐ jiào shénme' };
    expect(check('ni3 jiao4 shen2me', exp).verdict).toBe('wrong');
    expect(check('ni3 jiao4 shen2me', exp, { alternatives: [alt] }).verdict).toBe('correct');
  });

  it('accepts characters typed with an IME', () => {
    expect(check('你好！', nihao).verdict).toBe('correct');
    expect(check('您好', nihao).verdict).toBe('wrong');
  });

  it('accepts 他/她/它 for each other when typed in characters', () => {
    const r = check('他很高兴', { hanzi: '她很高兴。', pinyin: 'Tā hěn gāoxìng.' });
    expect(r.verdict).toBe('correct');
    expect(r.otherAnswer).toBe('她很高兴。');
    expect(check('她很高兴', { hanzi: '她很高兴。', pinyin: 'Tā hěn gāoxìng.' }).otherAnswer).toBeUndefined();
  });

  it('treats empty input as wrong', () => {
    expect(check('   ', nihao)).toMatchObject({ verdict: 'wrong', reason: 'empty' });
  });

  it('rejects conflicting tone information in one syllable', () => {
    expect(check('nǐ4 hao3', nihao).verdict).toBe('wrong');
  });
});

import { alignToHanzi } from './pinyin';
import { checkPinyinAgainstHanzi } from '../content/check';

describe('erhua (儿化)', () => {
  it('parses and marks erhua syllables', () => {
    expect(parsePinyin('nǎr')).toEqual([{ base: 'na', tone: 3, erhua: true }]);
    expect(markSyllable({ base: 'na', tone: 3, erhua: true })).toBe('nǎr');
    expect(toNumeric('yìdiǎnr')).toBe('yi4dianr3');
    expect(parsePinyin('ér')).toEqual([{ base: 'er', tone: 2 }]);
  });
  it('aligns 儿 with the previous syllable, but not in 女儿 or 儿子', () => {
    expect(alignToHanzi('哪儿', 'nǎr')?.charSyl).toEqual([0, 0]);
    expect(alignToHanzi('一点儿', 'yìdiǎnr')?.charSyl).toEqual([0, 1, 1]);
    expect(alignToHanzi('女儿', "nǚ'ér")?.charSyl).toEqual([0, 1]);
    expect(alignToHanzi('你去哪儿玩儿？', 'Nǐ qù nǎr wánr?')?.syls.length).toBe(4);
  });
  it('validates erhua content', () => {
    expect(checkPinyinAgainstHanzi('哪儿', 'nǎr')).toBeNull();
    expect(checkPinyinAgainstHanzi('一会儿', 'yíhuìr')).toBeNull();
    expect(checkPinyinAgainstHanzi('女儿', "nǚ'ér")).toBeNull();
  });
  it('accepts erhua answers with or without the r', () => {
    const exp = { hanzi: '你去哪儿？', pinyin: 'Nǐ qù nǎr?' };
    for (const input of ['ni3 qu4 nar3', 'nǐ qù nǎr', 'ni3 qu4 na3r', 'ni3 qu4 na3']) {
      expect(check(input, exp).verdict, input).toBe('correct');
    }
    expect(check('ni3 qu4 nar4', exp).verdict).toBe('wrong');
  });
});
