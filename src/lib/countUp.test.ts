import { describe, expect, it } from 'vitest';
import { countAt } from './countUp';

describe('count-up', () => {
  it('starts at 0, eases out and ends exactly on the target', () => {
    expect(countAt(97, 0)).toBe(0);
    expect(countAt(97, -1)).toBe(0);
    expect(countAt(97, 0.5)).toBe(85); // ease-out: most of it early
    expect(countAt(97, 1)).toBe(97);
    expect(countAt(97, 2)).toBe(97);
  });
  it('never goes backwards', () => {
    const seq = Array.from({ length: 21 }, (_, i) => countAt(250, i / 20));
    expect(seq.every((x, i) => i === 0 || x >= seq[i - 1])).toBe(true);
  });
});
