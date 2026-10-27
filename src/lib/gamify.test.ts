import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, bestComboOf, comboMultiplier, levelFor, newlyUnlocked, streakOf, xpByDay, xpFor } from './gamify';
import { dayStart } from './review';

/** Noon on day n of October 2026, local time. */
const day = (n: number) => new Date(2026, 9, n, 12).getTime();
const study = (days: number[], xp = 100) => xpByDay(days.map((d) => ({ at: day(d), xp })));

describe('XP', () => {
  it('rewards right answers and combos, up to double', () => {
    expect(xpFor('correct', 0)).toBe(10);
    expect(xpFor('correct', 5)).toBe(15);
    expect(xpFor('correct', 50)).toBe(20);
    expect(xpFor('almost', 0)).toBe(6);
    expect(xpFor('wrong', 9)).toBe(2); // no combo on a miss
    expect(xpFor('correct', 0, 'gym')).toBe(5);
    expect(comboMultiplier(3)).toBeCloseTo(1.3);
  });
  it('levels up at 100, 300, 600… XP', () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, span: 100 });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(300)).toEqual({ level: 3, into: 0, span: 300 });
    expect(levelFor(599).level).toBe(3);
  });
});

describe('streak', () => {
  it('counts days in a row with the goal met, today only once met', () => {
    expect(streakOf(study([1, 2, 3]), 100, day(4)).current).toBe(3);
    expect(streakOf(study([1, 2, 3, 4]), 100, day(4))).toMatchObject({ current: 4, todayDone: true });
    // Below the goal doesn't count.
    expect(streakOf(study([1, 2, 3], 50), 100, day(4)).current).toBe(0);
  });
  it('breaks after a missed day without a freeze', () => {
    expect(streakOf(study([1, 2, 4, 5]), 100, day(6))).toMatchObject({ current: 2, best: 2 });
  });
  it('earns a freeze every 7 days, which saves one missed day', () => {
    const s = streakOf(study([1, 2, 3, 4, 5, 6, 7, 9, 10]), 100, day(11));
    expect(s.current).toBe(9);
    expect(s.freezes).toBe(0);
    expect(s.frozenDays.map((d) => new Date(d).getDate())).toEqual([8]);
    // Two missed days with one freeze: broken.
    expect(streakOf(study([1, 2, 3, 4, 5, 6, 7, 10]), 100, day(11)).current).toBe(1);
    // Freezes stay banked (max 2).
    const banked = streakOf(study(Array.from({ length: 21 }, (_, i) => i + 1)), 100, day(22));
    expect(banked).toMatchObject({ current: 21, freezes: 2 });
  });
  it('uses 4 am as the day boundary', () => {
    const late = new Date(2026, 9, 2, 1, 30).getTime(); // still day 1
    expect(dayStart(late)).toBe(dayStart(day(1)));
    expect(streakOf(xpByDay([{ at: day(1), xp: 60 }, { at: late, xp: 60 }]), 100, day(2)).current).toBe(1);
  });
});

describe('achievements', () => {
  const base = { xp: 0, bestStreak: 0, matureWords: 0, startedWords: 0, reviews: 0, gymPairsRight: 0, gymBest: 0, bestCombo: 0, sessions: 0 };
  it('unlocks once, by condition', () => {
    const s = { ...base, sessions: 1, bestStreak: 8, gymPairsRight: 120 };
    const got = newlyUnlocked(s, new Set()).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(['first-session', 'streak-7', 'pairs-100']));
    expect(got).not.toContain('streak-30');
    expect(newlyUnlocked(s, new Set(got))).toEqual([]);
  });
  it('shows progress', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'mature-500')!;
    expect(a.progress({ ...base, matureWords: 250 })).toBe(0.5);
  });
  it('finds the best combo in session answers', () => {
    const logs = ['correct', 'correct', 'wrong', 'correct', 'almost', 'correct'].map((verdict, i) => ({ at: i, verdict: verdict as 'correct', xp: 1 }));
    expect(bestComboOf(logs)).toBe(3);
  });
});
