import { describe, expect, it } from 'vitest';
import type { ReviewItemRow, ReviewLogRow } from '../db/db';
import { review } from './review';
import { forecast, perDay, retention, toneAccuracy, wordsByLevel } from './statsData';

const now = new Date(2026, 9, 27, 12).getTime();
const DAY = 864e5;

function matured(id: string, n: number): ReviewItemRow {
  let row = review(undefined, id, 'good', now - 200 * DAY).row;
  for (let i = 1; i < n; i++) row = review(row, id, 'good', row.due + 1000).row;
  return row;
}
const log = (x: Partial<ReviewLogRow>): ReviewLogRow => ({ id: Math.random().toString(36), itemId: 'x', exercise: 'dictation', verdict: 'correct', at: now - 1000, updatedAt: 0, ...x });

describe('stats', () => {
  it('counts words by state per HSK level', () => {
    const words = [
      { id: 'a', level: 1 },
      { id: 'b', level: 1 },
      { id: 'c', level: 2 },
      { id: 'd', level: 0 },
    ];
    const cards = [matured('a#lm', 8), matured('a#lp', 8), matured('a#mp', 8), review(undefined, 'b#lm', 'good', now).row];
    const rows = wordsByLevel(words, cards);
    expect(rows.map((r) => r.level)).toEqual([1, 2]);
    expect(rows[0].counts).toEqual({ new: 0, learning: 1, young: 0, mature: 1 });
    expect(rows[1].counts.new).toBe(1);
  });
  it('measures true retention on long-term reviews only', () => {
    const logs = [
      log({ stateBefore: 2, rating: 3 }),
      log({ stateBefore: 2, rating: 2 }),
      log({ stateBefore: 2, rating: 1 }),
      log({ stateBefore: 0, rating: 1 }), // new card: not counted
      log({ stateBefore: 2, rating: 1, replaced: true }), // overridden: not counted
      log({ stateBefore: 2, rating: 3, at: now - 40 * DAY }), // too old for 30 days
    ];
    expect(retention(logs, now, 30)).toEqual({ n: 3, rate: 2 / 3 });
    expect(retention([], now, 7)).toEqual({ n: 0, rate: null });
  });
  it('forecasts reviews per day, overdue counted today', () => {
    const c = (id: string, due: number, state = 2) => ({ ...matured(id, 2), due, state });
    const cards = [c('a#lm', now - 5 * DAY), c('b#lm', now + 1000), c('c#lm', now + DAY), c('d#sp', now), c('e#lm', now, 0), c('w-ni', now)];
    const f = forecast(cards, now, false);
    expect(f).toHaveLength(14);
    expect(f[0].count).toBe(2);
    expect(f[1].count).toBe(1);
    expect(forecast(cards, now, true)[0].count).toBe(3);
  });
  it('sums time, accuracy and XP per day', () => {
    const rows = perDay(
      [log({ ms: 5000, xp: 10 }), log({ ms: 500_000, verdict: 'wrong', xp: 2 }), log({ exercise: 'intro', xp: 5 }), log({ at: now - 2 * DAY, xp: 10 })],
      now,
      7,
    );
    const today = rows[rows.length - 1];
    expect(today).toMatchObject({ answers: 2, accuracy: 0.5, xp: 17 });
    expect(today.minutes).toBe(1); // 5 s + 60 s (capped) + 8 s
    expect(rows[rows.length - 3].xp).toBe(10);
  });
  it('gives accuracy per tone', () => {
    const a = toneAccuracy([log({ tones: { expected: '3-3', given: '2-3' } }), log({ tones: { expected: '4', given: '2' } })]);
    expect(a[2]).toEqual({ tone: 3, n: 2, rate: 1 });
    expect(a[3]).toEqual({ tone: 4, n: 1, rate: 0 });
  });
});
