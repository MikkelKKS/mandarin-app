/**
 * Pace forecast (IDEAS #11): "at your last 4 weeks' pace, you reach X around
 * <date>". Weekly gains come from the review log only (nothing new is stored);
 * the range uses your best and slowest of those 4 weeks.
 */
import { parseCardId, MATURE_DAYS } from './review';

const DAY = 864e5;
const WEEKS = 4;
/** Below this much history, there's no forecast. */
export const MIN_HISTORY_DAYS = 21;

export type PaceMetric = 'xp' | 'reviews' | 'startedWords' | 'matureWords';

interface LogLike {
  at: number;
  card?: string;
  xp?: number;
  scheduledDays?: number;
  replaced?: boolean;
}

/** Gains in each of the last 4 weeks (oldest first), per metric; null when there's under 3 weeks of history. */
export function weeklyGains(logs: LogLike[], now: number): Record<PaceMetric, number[]> | null {
  const live = logs.filter((l) => !l.replaced);
  if (!live.length || now - Math.min(...live.map((l) => l.at)) < MIN_HISTORY_DAYS * DAY) return null;
  const start = now - WEEKS * 7 * DAY;
  const week = (t: number) => (t < start || t > now ? -1 : Math.min(WEEKS - 1, Math.floor((t - start) / (7 * DAY))));
  const out: Record<PaceMetric, number[]> = { xp: [0, 0, 0, 0], reviews: [0, 0, 0, 0], startedWords: [0, 0, 0, 0], matureWords: [0, 0, 0, 0] };
  // A word starts with its first listening/typing log; it matures when the last of its three
  // listening/typing cards first gets an interval of 21+ days.
  const firstSeen = new Map<string, number>();
  const firstMature = new Map<string, Map<string, number>>();
  for (const l of live) {
    const w = week(l.at);
    if (w >= 0) {
      out.xp[w] += l.xp ?? 0;
      if (l.card) out.reviews[w]++;
    }
    const p = l.card ? parseCardId(l.card) : null;
    if (!p || p.facet === 'sp') continue;
    firstSeen.set(p.word, Math.min(firstSeen.get(p.word) ?? Infinity, l.at));
    if ((l.scheduledDays ?? 0) >= MATURE_DAYS) {
      const m = firstMature.get(p.word) ?? new Map<string, number>();
      m.set(p.facet, Math.min(m.get(p.facet) ?? Infinity, l.at));
      firstMature.set(p.word, m);
    }
  }
  for (const t of firstSeen.values()) {
    const w = week(t);
    if (w >= 0) out.startedWords[w]++;
  }
  for (const m of firstMature.values()) {
    if (m.size < 3) continue;
    const w = week(Math.max(...m.values()));
    if (w >= 0) out.matureWords[w]++;
  }
  return out;
}

export interface Forecast {
  /** Most likely date (average pace), and the range from your best and slowest week. */
  at: number;
  early: number;
  /** Infinity when one of the 4 weeks gained nothing. */
  late: number;
}

/** When `remaining` more is reached at the pace of these weekly gains; null if there was no progress at all. */
export function forecast(remaining: number, weeks: number[], now: number): Forecast | null {
  if (remaining <= 0) return null;
  const total = weeks.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const perDay = (perWeek: number) => perWeek / 7;
  const days = (rate: number) => (rate > 0 ? remaining / rate : Infinity);
  return {
    at: now + days(perDay(total / weeks.length)) * DAY,
    early: now + days(perDay(Math.max(...weeks))) * DAY,
    late: now + days(perDay(Math.min(...weeks))) * DAY,
  };
}

/** Milestones for mature words. */
export const MATURE_MILESTONES = [100, 250, 500, 1000, 2000, 3000, 5000, 8000, 11000];
export const nextMilestone = (n: number) => MATURE_MILESTONES.find((m) => m > n) ?? null;
