/** XP, level, streak and achievements from the local database (see gamify.ts for the rules). */
import { db } from '../db/db';
import { ACHIEVEMENTS, bestComboOf, levelFor, newlyUnlocked, streakOf, xpByDay, type AchievementStats, type Streak } from './gamify';
import { parseCardId, wordState } from './review';

export interface GameStats {
  xp: number;
  level: ReturnType<typeof levelFor>;
  streak: Streak;
  goal: number;
  stats: AchievementStats;
  /** Achievement id → when it was unlocked. */
  unlocked: Map<string, number>;
}

export async function loadGameStats(goal: number, now = Date.now()): Promise<GameStats> {
  const [logs, cards, scores] = await Promise.all([db.reviewLogs.toArray(), db.reviewItems.toArray(), db.gameScores.toArray()]);
  const live = logs.filter((l) => !l.replaced);
  const xp = live.reduce((n, l) => n + (l.xp ?? 0), 0);
  const streak = streakOf(xpByDay(live), goal, now);

  // Words: started = any facet card reviewed or introduced; mature = weakest listening/typing facet 21+ days.
  const byWord = new Map<string, typeof cards>();
  for (const c of cards) {
    const p = parseCardId(c.id);
    if (!p || p.facet === 'sp') continue;
    byWord.set(p.word, [...(byWord.get(p.word) ?? []), c]);
  }
  let matureWords = 0;
  for (const cs of byWord.values()) if (wordState(cs) === 'mature') matureWords++;

  const score = new Map(scores.map((s) => [s.id, s]));
  const stats: AchievementStats = {
    xp,
    bestStreak: streak.best,
    matureWords,
    startedWords: byWord.size,
    reviews: live.filter((l) => l.card).length,
    gymPairsRight: live.filter((l) => l.exercise?.startsWith('tonegym') && l.verdict === 'correct' && l.tones?.expected.includes('-')).length,
    gymBest: Math.max(0, ...scores.filter((s) => s.id.startsWith('tonegym:')).map((s) => s.best)),
    bestCombo: bestComboOf(live),
    sessions: score.get('sessions')?.plays ?? 0,
  };
  const unlocked = new Map(scores.filter((s) => s.id.startsWith('ach:')).map((s) => [s.id.slice(4), s.updatedAt]));
  return { xp, level: levelFor(xp), streak, goal, stats, unlocked };
}

/** Store achievements reached now; returns the new ones. */
export async function unlockAchievements(g: GameStats, now = Date.now()) {
  const fresh = newlyUnlocked(g.stats, new Set(g.unlocked.keys()));
  for (const a of fresh) await db.gameScores.put({ id: `ach:${a.id}`, best: 1, plays: 1, updatedAt: now });
  return fresh;
}

export { ACHIEVEMENTS };
