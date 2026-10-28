import { describe, expect, it } from 'vitest';
import { schedule } from './srs';

const DAY = 864e5;
const t0 = Date.UTC(2026, 0, 1);

describe('FSRS wrapper', () => {
  it('schedules a new card and pushes good answers further out', () => {
    const first = schedule(undefined, 'w-ni', 'correct', t0);
    expect(first.reps).toBe(1);
    expect(first.due).toBeGreaterThan(t0);
    let card = first;
    let t = t0;
    for (let i = 0; i < 4; i++) {
      t = card.due + 1000;
      card = schedule(card, 'w-ni', 'correct', t);
    }
    expect(card.due - t).toBeGreaterThan(2 * DAY);
  });

  it('brings a card back soon after a wrong answer', () => {
    let card = schedule(undefined, 'w-hao', 'correct', t0);
    for (let i = 0; i < 4; i++) card = schedule(card, 'w-hao', 'correct', card.due + 1000);
    const before = card.due - card.lastReview!;
    const t = card.due + 1000;
    const after = schedule(card, 'w-hao', 'wrong', t);
    expect(after.lapses).toBe(1);
    expect(after.due - t).toBeLessThan(before);
    expect(after.due - t).toBeLessThan(DAY);
  });

  it('rates "almost" (missing tones) between wrong and correct', () => {
    let base = schedule(undefined, 'x', 'correct', t0);
    for (let i = 0; i < 3; i++) base = schedule(base, 'x', 'correct', base.due + 1000);
    const t = base.due + 1000;
    const good = schedule(base, 'x', 'correct', t).due;
    const almost = schedule(base, 'x', 'almost', t).due;
    const wrong = schedule(base, 'x', 'wrong', t).due;
    expect(almost).toBeLessThanOrEqual(good);
    expect(almost).toBeGreaterThanOrEqual(wrong);
  });

});
