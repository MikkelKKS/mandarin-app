import { describe, expect, it } from 'vitest';
import { mySentenceId } from '../../lib/mySentences';
import { parseDict } from './dict';
import { sentencePinyin } from './MySentences';

const dict = parseDict(
  [
    ['我', 'wǒ', 'wo', 'I', '1'],
    ['想', 'xiǎng', 'xiang', 'to want', '1'],
    ['去', 'qù', 'qu', 'to go', '1'],
    ['北京', 'Běi jīng', 'beijing', 'Beijing', '1'],
  ]
    .map((r) => r.join('\t'))
    .join('\n'),
);

describe('saving your own sentences', () => {
  it('pinyin word by word, with the punctuation', () => {
    expect(sentencePinyin(dict, '我想去北京。', ['wǒ', 'xiǎng', 'qù', 'běi', 'jīng'])).toBe('wǒ xiǎng qù běijīng.');
  });
  it('one id per sentence, however it was spaced', () => {
    expect(mySentenceId('我想去北京。')).toBe(mySentenceId(' 我想去 北京。'));
    expect(mySentenceId('我想去北京。')).not.toBe(mySentenceId('我想去上海。'));
    expect(mySentenceId('我想去北京。')).toMatch(/^m-[a-z0-9]+$/);
  });
});
