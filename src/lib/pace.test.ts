import { describe, expect, it } from 'vitest';
import { forecast, nextMilestone, weeklyGains } from './pace';

const DAY = 864e5;
const now = Date.UTC(2026, 10, 2, 12);

describe('pace forecast', () => {
  it('needs three weeks of history', () => {
    expect(weeklyGains([{ at: now - 10 * DAY, xp: 5 }], now)).toBeNull();
    expect(weeklyGains([], now)).toBeNull();
  });
  it('sums XP, reviews, started and matured words per week', () => {
    const logs = [
      { at: now - 40 * DAY, card: 'a#lm', xp: 1 }, // before the window: a starts then
      { at: now - 27 * DAY, card: 'b#lm', xp: 10 },
      { at: now - 26 * DAY, card: 'b#lp', xp: 10 },
      { at: now - 3 * DAY, card: 'c#mp', xp: 4 },
      { at: now - 2 * DAY, card: 'c#mp', xp: 4, replaced: true },
      // a matures this week: its last facet reaches 21+ days now
      { at: now - 20 * DAY, card: 'a#lm', scheduledDays: 25 },
      { at: now - 15 * DAY, card: 'a#lp', scheduledDays: 22 },
      { at: now - 1 * DAY, card: 'a#mp', scheduledDays: 30 },
      { at: now - 1 * DAY, card: 'b#sp', scheduledDays: 30 }, // speaking doesn't count
    ];
    const g = weeklyGains(logs, now)!;
    expect(g.xp).toEqual([20, 0, 0, 4]);
    expect(g.reviews).toEqual([2, 2, 0, 3]);
    expect(g.startedWords).toEqual([1, 0, 0, 1]);
    expect(g.matureWords).toEqual([0, 0, 0, 1]);
  });
  it('dates a target from the average pace, with best and slowest week as the range', () => {
    const f = forecast(70, [10, 20, 10, 30], now)!;
    expect(Math.round((f.at - now) / DAY)).toBe(28); // 17.5 a week
    expect(Math.round((f.early - now) / DAY)).toBe(16); // 30 a week
    expect(Math.round((f.late - now) / DAY)).toBe(49); // 10 a week
    expect(forecast(70, [0, 0, 7, 0], now)!.late).toBe(Infinity);
    expect(forecast(70, [0, 0, 0, 0], now)).toBeNull();
    expect(forecast(0, [5, 5, 5, 5], now)).toBeNull();
  });
  it('picks the next mature-word milestone', () => {
    expect([0, 99, 100, 480, 11000].map(nextMilestone)).toEqual([100, 100, 250, 500, null]);
  });
});
