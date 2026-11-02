import { describe, expect, it } from 'vitest';
import { sentenceSandhi } from './sandhi';

describe('sentence sandhi', () => {
  it('3rd + 3rd', () => {
    expect(sentenceSandhi('你好！', 'Nǐ hǎo!')).toEqual({ changes: [{ from: 'nǐ hǎo', to: 'ní hǎo' }], rules: ['A 3rd tone before another 3rd is said as a 2nd.'] });
  });
  it('runs of 3rd tones merge into one change', () => {
    expect(sentenceSandhi('我也很好。', 'Wǒ yě hěn hǎo.')?.changes).toEqual([{ from: 'wǒ yě hěn hǎo', to: 'wó yé hén hǎo' }]);
  });
  it('不 and 一', () => {
    const r = sentenceSandhi('我不是一个学生。', 'Wǒ bù shì yí gè xuésheng.');
    expect(r?.changes).toEqual([{ from: 'bù shì', to: 'bú shì' }]);
    expect(sentenceSandhi('一天', 'yītiān')?.changes).toEqual([{ from: 'yī tiān', to: 'yì tiān' }]);
    expect(sentenceSandhi('一样', 'yīyàng')?.changes).toEqual([{ from: 'yī yàng', to: 'yí yàng' }]);
  });
  it('leaves counting, ordinals, neutral tones and phrase breaks alone', () => {
    expect(sentenceSandhi('第一天', 'dì yī tiān')).toBeNull();
    expect(sentenceSandhi('十一', 'shíyī')).toBeNull();
    expect(sentenceSandhi('对不起', 'duìbuqǐ')).toBeNull();
    expect(sentenceSandhi('我，你', 'wǒ, nǐ')).toBeNull();
    expect(sentenceSandhi('是我。', 'Shì wǒ.')).toBeNull();
    expect(sentenceSandhi('发展美元', 'fāzhǎn měiyuán')).toBeNull();
    expect(sentenceSandhi('我想你', 'wǒ xiǎng nǐ')?.changes).toEqual([{ from: 'wǒ xiǎng nǐ', to: 'wó xiáng nǐ' }]);
  });
});
