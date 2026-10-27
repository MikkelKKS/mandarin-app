import { describe, expect, it } from 'vitest';
import type { ReviewItemRow } from '../../db/db';
import type { VocabRow } from '../../lib/vocabData';
import { knownBelow, knownFromResults, matureCards, sampleLevel, shouldContinue } from './placement';

const words: VocabRow[] = [];
let order = 0;
for (const level of [1, 2, 3]) for (let i = 0; i < 100; i++) words.push({ id: `L${level}-${i}`, hanzi: '你', pinyin: 'nǐ', gloss: ['you'], level, order: ++order, examples: [], azure: i % 10 !== 9 });

describe('placement', () => {
  it('samples a level evenly over its frequency order, only words with a recording', () => {
    const s = sampleLevel(words, 2, 8);
    expect(s).toHaveLength(8);
    expect(s.every((w) => w.level === 2 && w.azure)).toBe(true);
    const orders = s.map((w) => w.order);
    expect(orders[0]).toBeLessThan(120);
    expect(orders[7]).toBeGreaterThan(180);
  });
  it('stops after a level below 50%', () => {
    expect(shouldContinue({ level: 1, asked: 8, right: 4 })).toBe(true);
    expect(shouldContinue({ level: 1, asked: 8, right: 3 })).toBe(false);
  });
  it('marks passed levels, the common part of the boundary level, and right answers', () => {
    const known = knownFromResults(
      words,
      [
        { level: 1, asked: 8, right: 8 },
        { level: 2, asked: 8, right: 4 },
        { level: 3, asked: 8, right: 1 },
      ],
      new Set(['L3-50']),
    );
    expect(known.filter((id) => id.startsWith('L1-'))).toHaveLength(100);
    const l2 = known.filter((id) => id.startsWith('L2-'));
    expect(l2).toHaveLength(50);
    expect(l2).toContain('L2-0'); // the most common ones
    expect(l2).not.toContain('L2-99');
    // Level 3 isn't marked (stopped at level 2), except the word answered right.
    expect(known.filter((id) => id.startsWith('L3-'))).toEqual(['L3-50']);
  });
  it('marks everything below a chosen starting level', () => {
    expect(knownBelow(words, 3)).toHaveLength(200);
    expect(knownBelow(words, 1)).toHaveLength(0);
  });
  it('makes mature listening and typing cards, spread out, without undoing better ones', () => {
    const now = Date.UTC(2026, 9, 27);
    const strong = { id: 'a#lm', state: 2, scheduledDays: 90 } as ReviewItemRow;
    const rows = matureCards(['a', 'b'], new Map([[strong.id, strong]]), now, () => 0.5);
    expect(rows.map((r) => r.id).sort()).toEqual(['a#lp', 'a#mp', 'b#lm', 'b#lp', 'b#mp']);
    expect(rows.every((r) => r.state === 2 && r.scheduledDays >= 21 && r.due > now + 20 * 864e5)).toBe(true);
    expect(rows.some((r) => r.id.endsWith('#sp'))).toBe(false);
  });
});
