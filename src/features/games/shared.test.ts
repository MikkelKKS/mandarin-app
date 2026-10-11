import { describe, expect, it } from 'vitest';
import { pickWeighted, weightOf } from './shared';
import { schedule } from '../../lib/srs';

describe('game word pool', () => {
  it('weights due and often-missed items higher', () => {
    const now = Date.now();
    const fresh = weightOf(undefined, now);
    let shaky = schedule(undefined, 'a', 'wrong', now - 864e5 * 3);
    shaky = { ...shaky, due: now - 1000, lapses: 2 };
    expect(weightOf(shaky, now)).toBeGreaterThan(fresh);
  });
  it('picks distinct items, biased by weight', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    const w = new Map([['a', 50]]);
    let a = 0;
    for (let i = 0; i < 200; i++) {
      const p = pickWeighted(items, w, 2);
      expect(new Set(p.map((x) => x.id)).size).toBe(2);
      if (p[0].id === 'a') a++;
    }
    expect(a).toBeGreaterThan(120);
  });
});
