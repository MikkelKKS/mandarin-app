import { describe, expect, it } from 'vitest';
import { billedChars, hintSpans, monthKey, remaining, sapiPhones, ssml, voiceBody } from './azure-tts-lib';

describe('Azure TTS helpers', () => {
  it('counts Chinese characters twice and markup once, as Azure bills', () => {
    expect(billedChars('你好')).toBe(4);
    expect(billedChars('你好！')).toBe(5);
    expect(billedChars('<prosody rate="-30%">你好</prosody>')).toBe(4 + '<prosody rate="-30%"></prosody>'.length);
  });
  it('only adds pronunciation hints where the default reading is wrong, around that word only', () => {
    expect(hintSpans('银行', 'yínháng')).toEqual([]);
    expect(hintSpans('还书', 'huán shū')).toEqual([{ start: 0, end: 1, phones: ['huan2'] }]);
    expect(hintSpans('东西', 'dōngxi')).toEqual([{ start: 0, end: 2, phones: ['dong1', 'xi5'] }]);
    // In a sentence only the word concerned gets a hint (空 kòng), not the whole sentence.
    expect(hintSpans('你明天有空吗？', 'Nǐ míngtiān yǒu kòng ma?')).toEqual([{ start: 4, end: 5, phones: ['kong4'] }]);
    expect(hintSpans('我得走了。', 'Wǒ děi zǒu le.')).toEqual([{ start: 1, end: 2, phones: ['dei3'] }]);
    // Tone changes Azure makes by itself need no hint.
    expect(hintSpans('不是', 'bú shì')).toEqual([]);
    expect(hintSpans('你好', 'ní hǎo')).toEqual([]);
    // A reported recording gets every word spelled out, word by word.
    expect(hintSpans('你明天有空吗？', 'Nǐ míngtiān yǒu kòng ma?', { all: true }).map((h) => h.phones.join(' '))).toEqual([
      'ni3',
      'ming2 tian1',
      'you3',
      'kong4',
      'ma5',
    ]);
    // 儿化 can't be hinted syllable by syllable.
    expect(hintSpans('哪儿', 'nǎr')).toEqual([]);
  });
  it('writes hints in either phone format', () => {
    expect(sapiPhones(['huan2', 'shu1'], 'spaced')).toBe('huan 2 shu 1');
    expect(sapiPhones(['huan2', 'shu1'], 'joined')).toBe('huan2 shu1');
    expect(voiceBody({ hanzi: '你明天有空吗？', hints: [{ start: 4, end: 5, phones: ['kong4'] }] })).toBe(
      '你明天有<phoneme alphabet="sapi" ph="kong 4">空</phoneme>吗？',
    );
    expect(voiceBody({ hanzi: '我很忙。', slow: true })).toBe('<prosody rate="-30%">我很忙。</prosody>');
  });
  it('builds SSML with the chosen voices and no speaking style', () => {
    const x = ssml('m', '你好');
    expect(x).toContain('zh-CN-YunxiNeural');
    expect(x).not.toContain('express-as');
  });
  it('stops before the monthly free quota', () => {
    const now = new Date(Date.UTC(2026, 9, 27));
    expect(monthKey(now)).toBe('2026-10');
    expect(remaining({ months: { '2026-10': 400_000 } }, now)).toBe(80_000);
    expect(remaining({ months: { '2026-09': 499_000 } }, now)).toBe(480_000);
  });
});
