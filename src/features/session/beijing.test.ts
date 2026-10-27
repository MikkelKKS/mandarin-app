import { describe, expect, it } from 'vitest';
import { beijingWords, wordOrder } from './beijing';

describe('Beijing pack', () => {
  it('collects the erhua and Beijing words from the course', () => {
    const ids = beijingWords();
    expect(ids.length).toBeGreaterThan(12);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('puts them first when on, keeping the rest in order', () => {
    const pack = beijingWords();
    const order = ['a', pack[0], 'b', pack[1]];
    expect(wordOrder(order, false)).toEqual(order);
    expect(wordOrder(order, true)).toEqual([pack[0], pack[1], 'a', 'b']);
  });
});
