import { describe, expect, it } from 'vitest';
import { liveToneMarks } from './pinyinLive';

/** Type a string one key at a time, as the input would see it. */
function type(keys: string): string {
  let v = '';
  for (const k of keys) v = liveToneMarks(v + k, v.length + 1).value;
  return v;
}

describe('live tone marks', () => {
  it('turns tone numbers into marks as you type', () => {
    expect(type('ni3')).toBe('nǐ');
    expect(type('ni3hao3')).toBe('nǐhǎo');
    expect(type('ni3 hao3')).toBe('nǐ hǎo');
    expect(type('xie4xie5')).toBe('xièxie');
    expect(type('xie4xie0')).toBe('xièxie');
  });
  it('puts the mark on the right vowel', () => {
    expect(type('dou1')).toBe('dōu');
    expect(type('gui4')).toBe('guì');
    expect(type('liu2')).toBe('liú');
    expect(type('zhuang4')).toBe('zhuàng');
  });
  it('handles ü written as v or u:', () => {
    expect(type('nv3')).toBe('nǚ');
    expect(type('lu:4')).toBe('lǜ');
    expect(type('nu:')).toBe('nü');
  });
  it('changes a tone that was already there', () => {
    expect(type('hao3') + '').toBe('hǎo');
    expect(liveToneMarks('hǎo4', 4).value).toBe('hào');
    expect(liveToneMarks('hǎo5', 4).value).toBe('hao');
  });
  it('keeps capitals', () => {
    expect(type('Bei3jing1')).toBe('Běijīng');
  });
  it('leaves things that are not syllables alone', () => {
    expect(type('q3')).toBe('q3');
    expect(type('3')).toBe('3');
  });
  it('works in the middle of the text and moves the caret', () => {
    const r = liveToneMarks('ni3 hao', 3);
    expect(r).toEqual({ value: 'nǐ hao', caret: 2 });
  });
});
