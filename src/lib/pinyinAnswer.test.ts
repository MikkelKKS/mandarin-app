import { describe, expect, it } from 'vitest';
import { checkPinyinAnswer as check, gradeOf } from './pinyinAnswer';
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

  it('marks missing tones as wrong (strict, the default) or almost (lenient)', () => {
    const r = check('ni hao', nihao);
    expect(r.verdict).toBe('wrong');
    expect(r.reason).toBe('missing-tones');
    expect(r.syllables?.map((s) => s.status)).toEqual(['missing', 'missing']);
    expect(check('ni hao', nihao, { strictTones: false }).verdict).toBe('almost');
    expect(check('ni3 hao', nihao, { strictTones: false }).verdict).toBe('almost');
  });

  it('rejects wrong tones and reports which syllable', () => {
    const r = check('ni3 hao4', nihao);
    expect(r.verdict).toBe('wrong');
    expect(r.reason).toBe('wrong-tones');
    expect(r.syllables?.map((s) => s.status)).toEqual(['ok', 'wrong-tone']);
    expect(r.syllables?.[1]).toMatchObject({ tone: 3, given: 4, typed: 'hào' });
  });

  it('grades a wrong tone as Hard in lenient mode and Again in strict mode', () => {
    expect(gradeOf(check('ni3 hao4', nihao).verdict)).toBe('again');
    const lenient = check('ni3 hao4', nihao, { strictTones: false });
    expect(lenient.verdict).toBe('almost');
    expect(gradeOf(lenient.verdict)).toBe('hard');
    expect(gradeOf(check('ni3 hao3', nihao).verdict)).toBe('good');
    // A wrong syllable is never lenient.
    expect(gradeOf(check('ni3 hen3', nihao, { strictTones: false }).verdict)).toBe('again');
  });

  it('scores each syllable even when one syllable is wrong', () => {
    const exp = { hanzi: '我喜欢跑步', pinyin: 'wǒ xǐhuan pǎobù' };
    const r = check('wo3 xi2huan pao3 ma4', exp);
    expect(r.verdict).toBe('wrong');
    expect(r.reason).toBe('mismatch');
    expect(r.syllables?.map((s) => s.status)).toEqual(['ok', 'wrong-tone', 'ok', 'ok', 'wrong-syllable']);
    expect(r.syllables?.[1]).toMatchObject({ tone: 3, given: 2 });
    expect(r.syllables?.[4]).toMatchObject({ expected: 'bù', typed: 'mà' });
  });

  it('gives no typo pass when a tone is also wrong', () => {
    const exp = { hanzi: '我喜欢跑步', pinyin: 'wǒ xǐhuan pǎobù' };
    expect(check('wo3 xi3huan pao3 ba4', exp).verdict).toBe('typo');
    expect(check('wo3 xi2huan pao3 ba4', exp).verdict).toBe('wrong');
  });

  it('marks left-out and extra syllables', () => {
    const exp = { hanzi: '我喜欢跑步', pinyin: 'wǒ xǐhuan pǎobù' };
    const left = check('wo3 xi3huan bu4', exp);
    expect(left.syllables?.map((s) => s.status)).toEqual(['ok', 'ok', 'ok', 'skipped', 'ok']);
    const more = check('wo3 hen3 xi3huan pao3bu4', exp);
    expect(more.syllables?.every((s) => s.status === 'ok')).toBe(true);
    expect(more.extra).toEqual(['hěn']);
    const both = check('wo4 hen3 xi3huan pao3bu4', exp);
    expect(both.syllables?.[0]).toMatchObject({ status: 'wrong-tone', typed: 'wò' });
  });

  it('ignores apostrophes and hyphens', () => {
    expect(check("xi1'an1", { hanzi: '西安', pinyin: "Xī'ān" }).verdict).toBe('correct');
    expect(check('pao3-bu4', { hanzi: '跑步', pinyin: 'pǎobù' }).verdict).toBe('correct');
    expect(check("nǐ-hǎo", nihao).verdict).toBe('correct');
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
    const r = check('wo3 hen3 gao1xin4 ren4shi ni3', long);
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
    expect(check('您好', nihao).verdict).toBe('correct'); // polite 您 is fine too
    expect(check('他好', nihao).verdict).toBe('wrong');
  });

  it('accepts 他/她/它 for each other when typed in characters', () => {
    const r = check('他很高兴', { hanzi: '她很高兴。', pinyin: 'Tā hěn gāoxìng.' });
    expect(r.verdict).toBe('correct');
    expect(r.otherAnswer).toBe('她很高兴。');
    expect(check('她很高兴', { hanzi: '她很高兴。', pinyin: 'Tā hěn gāoxìng.' }).otherAnswer).toBeUndefined();
  });

  it('allows 一个 to be left out or added', () => {
    const withYige = { hanzi: '我有一个哥哥。', pinyin: 'Wǒ yǒu yí ge gēge.' };
    const without = { hanzi: '我有哥哥。', pinyin: 'Wǒ yǒu gēge.' };
    expect(check('wo3 you3 ge1ge', withYige).verdict).toBe('correct');
    expect(check('wo3 you3 ge1ge', withYige).otherAnswer).toBe('我有一个哥哥。');
    expect(check('wo3 you3 yi2 ge4 ge1ge', without).verdict).toBe('correct');
    expect(check('我有哥哥', withYige).verdict).toBe('correct');
    expect(check('我有一个哥哥', without).verdict).toBe('correct');
    expect(check('wo3 you3 yi2 ge4 ge1ge', withYige).otherAnswer).toBeUndefined();
    expect(check('wo3 you3 jie3jie', withYige).verdict).toBe('wrong');
  });

  it('accepts everyday equivalents like 你 for 您 and 哪里 for 哪儿', () => {
    const r = check('ni3 qu4 na3li3', { hanzi: '您去哪儿？', pinyin: 'Nín qù nǎr?' });
    expect(r.verdict).toBe('correct');
    expect(r.otherAnswer).toBe('您去哪儿？');
    expect(check('nin2 hao3', nihao).verdict).toBe('correct');
    expect(check('我们走吧', { hanzi: '咱们走吧。', pinyin: 'Zánmen zǒu ba.' }).verdict).toBe('correct');
    expect(check('ta1 qu4 na3li3', { hanzi: '您去哪儿？', pinyin: 'Nín qù nǎr?' }).verdict).toBe('wrong');
  });

  it('allows possessive 的 after a pronoun to be added or left out', () => {
    const dad = { hanzi: '这是我爸爸。', pinyin: 'Zhè shì wǒ bàba.' };
    expect(check('这是我的爸爸', dad).verdict).toBe('correct');
    expect(check('zhe4 shi4 wo3 de bah4ba', dad).verdict).not.toBe('correct');
    expect(check('zhe4 shi4 wo3 de ba4ba', dad).verdict).toBe('correct');
    expect(check('zhe4 shi4 wo3de ba4ba', dad).verdict).toBe('correct');
    const phone = { hanzi: '我的手机在哪里？', pinyin: 'Wǒ de shǒujī zài nǎlǐ?' };
    expect(check('wo3 shou3ji1 zai4 na3li3', phone).verdict).toBe('correct');
    expect(check('我手机在哪里', phone).verdict).toBe('correct');
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
