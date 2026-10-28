/**
 * XP, levels, daily goal, streak (with streak freezes) and achievements
 * (CLAUDE.md §2). Everything is worked out from the review log, which syncs
 * and is append-only, so both devices always agree. Each answer in a session
 * stores the XP it earned (`xp` on the log entry); achievements, once
 * unlocked, are kept in the synced gameScores table as `ach:<id>`.
 */
import { dayStart } from './review';
import type { Verdict } from './pinyinAnswer';

// ---------------------------------------------------------------------------
// XP

export const XP = { correct: 10, almost: 6, wrong: 2, newWord: 5, gymRight: 5, gymWrong: 1 } as const;
/** Combo: each answer in a row adds 10%, up to double XP. */
export const MAX_COMBO_BONUS = 10;

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, MAX_COMBO_BONUS) * 0.1;
}

/** XP for one answer; `combo` is how many right answers came straight before it. */
export function xpFor(verdict: Verdict, combo: number, kind: 'review' | 'gym' = 'review'): number {
  const base =
    kind === 'gym'
      ? verdict === 'wrong'
        ? XP.gymWrong
        : XP.gymRight
      : verdict === 'correct' || verdict === 'typo'
        ? XP.correct
        : verdict === 'almost'
          ? XP.almost
          : XP.wrong;
  return Math.round(base * (verdict === 'wrong' ? 1 : comboMultiplier(combo)));
}

/** Level L needs 50·L·(L−1) XP in all: 100 for level 2, 300 for 3, 600 for 4… */
export function levelFor(xp: number): { level: number; into: number; span: number } {
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
  const start = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, into: xp - start, span: next - start };
}

// ---------------------------------------------------------------------------
// Days, goal and streak

export interface XpLog {
  at: number;
  xp?: number;
}

/** XP per day (keyed by the day's 4 am start). */
export function xpByDay(logs: XpLog[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of logs) {
    if (!l.xp) continue;
    const d = dayStart(l.at);
    out.set(d, (out.get(d) ?? 0) + l.xp);
  }
  return out;
}

const DAY = 864e5;
/** The next day's start (DST-safe: steps by a day plus a bit, then snaps to 4 am). */
const nextDay = (d: number) => dayStart(d + DAY + 6 * 3600e3);

export interface Streak {
  /** Days in a row with the goal met (today counts once it's met). */
  current: number;
  best: number;
  /** Streak freezes in the bank (one per 7 goal days in a row, at most 2). */
  freezes: number;
  /** Days a freeze saved the streak. */
  frozenDays: number[];
  todayXp: number;
  todayDone: boolean;
}

export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

/**
 * Walk day by day from the first study day. A day counts when its XP reaches the
 * goal; a missed day uses a banked freeze if there is one, otherwise the streak
 * resets. Today never breaks the streak: it only adds once the goal is met.
 */
export function streakOf(byDay: Map<number, number>, goal: number, now: number): Streak {
  const today = dayStart(now);
  const todayXp = byDay.get(today) ?? 0;
  const days = [...byDay.keys()].filter((d) => (byDay.get(d) ?? 0) >= goal).sort((a, b) => a - b);
  let current = 0;
  let best = 0;
  let freezes = 0;
  let run = 0; // goal days in a row since the last freeze was earned
  const frozenDays: number[] = [];
  if (days.length) {
    for (let d = days[0]; d < today; d = nextDay(d)) {
      if ((byDay.get(d) ?? 0) >= goal) {
        current++;
        run++;
        if (run >= FREEZE_EVERY) {
          run = 0;
          freezes = Math.min(MAX_FREEZES, freezes + 1);
        }
      } else if (current > 0 && freezes > 0) {
        freezes--;
        frozenDays.push(d);
      } else {
        current = 0;
        run = 0;
      }
      best = Math.max(best, current);
    }
  }
  const todayDone = todayXp >= goal;
  if (todayDone) current++;
  best = Math.max(best, current);
  return { current, best, freezes, frozenDays, todayXp, todayDone };
}

// ---------------------------------------------------------------------------
// Achievements

export interface AchievementStats {
  xp: number;
  bestStreak: number;
  matureWords: number;
  startedWords: number;
  reviews: number;
  /** Tone questions answered right (Tone Gym rounds and the tone questions in sessions). */
  gymRight: number;
  /** Best Tone Gym round score (out of 20). */
  gymBest: number;
  bestCombo: number;
  sessions: number;
}

export interface Achievement {
  id: string;
  title: string;
  hanzi: string;
  detail: string;
  done: (s: AchievementStats) => boolean;
  /** Progress towards it, 0 to 1. */
  progress: (s: AchievementStats) => number;
}

const goalOf = (get: (s: AchievementStats) => number, target: number) => ({
  done: (s: AchievementStats) => get(s) >= target,
  progress: (s: AchievementStats) => Math.min(1, get(s) / target),
});

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-session', title: 'First session', hanzi: '开始', detail: 'Finish a session', ...goalOf((s) => s.sessions, 1) },
  { id: 'streak-7', title: 'A week in a row', hanzi: '一周', detail: '7-day streak', ...goalOf((s) => s.bestStreak, 7) },
  { id: 'streak-30', title: 'A month in a row', hanzi: '一个月', detail: '30-day streak', ...goalOf((s) => s.bestStreak, 30) },
  { id: 'streak-100', title: 'Hundred days', hanzi: '百天', detail: '100-day streak', ...goalOf((s) => s.bestStreak, 100) },
  { id: 'words-100', title: '100 words', hanzi: '一百', detail: 'Start learning 100 words', ...goalOf((s) => s.startedWords, 100) },
  { id: 'words-1000', title: '1,000 words', hanzi: '一千', detail: 'Start learning 1,000 words', ...goalOf((s) => s.startedWords, 1000) },
  { id: 'mature-100', title: '100 words mature', hanzi: '熟', detail: '100 words with every skill 21+ days out', ...goalOf((s) => s.matureWords, 100) },
  { id: 'mature-500', title: '500 words mature', hanzi: '熟练', detail: '500 words mature', ...goalOf((s) => s.matureWords, 500) },
  { id: 'mature-2000', title: '2,000 words mature', hanzi: '精通', detail: '2,000 words mature', ...goalOf((s) => s.matureWords, 2000) },
  { id: 'tones-500', title: 'Tone ear', hanzi: '声调', detail: '500 tone questions right (Tone Gym and sessions)', ...goalOf((s) => s.gymRight, 500) },
  { id: 'tones-2000', title: 'Golden ear', hanzi: '耳朵', detail: '2,000 tone questions right', ...goalOf((s) => s.gymRight, 2000) },
  { id: 'gym-20', title: 'Flawless round', hanzi: '完美', detail: '20 out of 20 in a Tone Gym round', ...goalOf((s) => s.gymBest, 20) },
  { id: 'combo-25', title: 'On a roll', hanzi: '连胜', detail: '25 right in a row', ...goalOf((s) => s.bestCombo, 25) },
  { id: 'reviews-1000', title: '1,000 reviews', hanzi: '千次', detail: 'Answer 1,000 reviews', ...goalOf((s) => s.reviews, 1000) },
  // Level 10 = 50·10·9 = 4,500 XP; progress by XP, not by level number.
  { id: 'level-10', title: 'Level 10', hanzi: '十级', detail: 'Reach level 10', ...goalOf((s) => s.xp, 4500) },
];

/** Achievements newly reached (not yet in `unlocked`). */
export function newlyUnlocked(stats: AchievementStats, unlocked: Set<string>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.done(stats));
}

/** Longest run of right answers in the log (in time order, sessions only). */
export function bestComboOf(logs: Array<{ at: number; verdict: Verdict; xp?: number }>): number {
  let best = 0;
  let run = 0;
  for (const l of [...logs].filter((x) => x.xp !== undefined).sort((a, b) => a.at - b.at)) {
    if (l.verdict === 'wrong') run = 0;
    else best = Math.max(best, ++run);
  }
  return best;
}
