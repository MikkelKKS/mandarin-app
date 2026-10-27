import { describe, expect, it } from 'vitest';
import { billedChars, monthKey, needsHint, remaining, sapiPhones, ssml, voiceBody } from './azure-tts-lib';

describe('Azure TTS helpers', () => {
  it('counts Chinese characters twice and markup once, as Azure bills', () => {
    expect(billedChars('你好')).toBe(4);
    expect(billedChars('你好！')).toBe(5);
    expect(billedChars('<prosody rate="-20%">你好</prosody>')).toBe(4 + '<prosody rate="-20%"></prosody>'.length);
  });
  it('only adds pronunciation hints where the default reading is wrong', () => {
    expect(needsHint('银行', 'yínháng')).toBeNull();
    expect(needsHint('还书', 'huán shū')).toEqual(['huan2', 'shu1']);
    expect(needsHint('东西', 'dōngxi')).toEqual(['dong1', 'xi5']);
    // Tone changes Azure makes by itself need no hint.
    expect(needsHint('不是', 'bú shì')).toBeNull();
    expect(needsHint('你好', 'ní hǎo')).toBeNull();
    // 儿化 can't be hinted syllable by syllable.
    expect(needsHint('哪儿', 'nǎr')).toBeNull();
  });
  it('writes hints in either phone format', () => {
    expect(sapiPhones(['huan2', 'shu1'], 'spaced')).toBe('huan 2 shu 1');
    expect(sapiPhones(['huan2', 'shu1'], 'joined')).toBe('huan2 shu1');
    expect(voiceBody({ hanzi: '还书', hint: ['huan2', 'shu1'] })).toBe('<phoneme alphabet="sapi" ph="huan 2 shu 1">还书</phoneme>');
    expect(voiceBody({ hanzi: '我很忙。', slow: true })).toBe('<prosody rate="-20%">我很忙。</prosody>');
  });
  it('builds SSML with the chosen voices and no speaking style', () => {
    const x = ssml('m', '你好');
    expect(x).toContain('zh-CN-YunjianNeural');
    expect(x).not.toContain('express-as');
  });
  it('stops before the monthly free quota', () => {
    const now = new Date(Date.UTC(2026, 9, 27));
    expect(monthKey(now)).toBe('2026-10');
    expect(remaining({ months: { '2026-10': 400_000 } }, now)).toBe(80_000);
    expect(remaining({ months: { '2026-09': 499_000 } }, now)).toBe(480_000);
  });
});
