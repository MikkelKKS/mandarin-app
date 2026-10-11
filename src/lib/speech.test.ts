import { describe, expect, it } from 'vitest';
import { similarity } from './speech';

describe('speech similarity', () => {
  it('scores character overlap, ignoring punctuation', () => {
    expect(similarity('你好', '你好！')).toBe(1);
    expect(similarity('我很好', '我很好，你呢？')).toBeCloseTo(3 / 5);
    expect(similarity('', '你好')).toBe(0);
  });
});
