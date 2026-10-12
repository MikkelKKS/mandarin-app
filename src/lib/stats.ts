/**
 * Learning statistics for the Progress page (pure, so it can be unit-tested).
 * No streaks or points: just what you know, what's due and what's hard.
 */
import type { ReviewItemRow, ReviewLogRow } from '../db/db';
import type { NodeState } from './progress';

const DAY = 864e5;
/** FSRS card states. */
const REVIEW = 2;

export interface StatWord {
  id: string;
  hsk: number;
  unit: string;
}
export interface StatUnit {
  id: string;
  title: string;
  titleHanzi: string;
  hsk: number;
  nodes: string[];
}

export interface HskCoverage {
  level: number;
  total: number;
  known: number; // in long-term review
  learning: number; // seen, not yet stable
}

export interface ToneStat {
  tone: number; // 1 to 5
  attempts: number;
  right: number;
}

export interface Stats {
  /** HSK level currently being worked on (1 to 3), or 4 when 1 to 3 are mostly known. */
  level: number;
  coverage: HskCoverage[];
  wordsKnown: number;
  wordsSeen: number;
  dueNow: number;
  /** Reviews coming due on each of the next 7 days (index 0 = later today). */
  forecast: number[];
  tones: ToneStat[];
  /** Most common tone mix-ups, e.g. heard/typed 2 when it was 3. */
  confusions: Array<{ expected: number; given: number; count: number }>;
  /** Items answered wrong most often in the last 60 days. */
  missed: Array<{ id: string; wrong: number; total: number }>;
  /** Answers per day for the last 14 days (oldest first). */
  activity: number[];
  units: Array<{ id: string; title: string; titleHanzi: string; hsk: number; done: number; total: number; mastery: number }>;
}

/** A word counts as known once it's in long-term review. */
export function isKnown(r: ReviewItemRow | undefined): boolean {
  return !!r && r.state === REVIEW;
}

/** Level being worked on: the first HSK level where under 80% of the words are known. */
export function currentLevel(coverage: HskCoverage[]): number {
  for (const c of coverage) if (c.total > 0 && c.known / c.total < 0.8) return c.level;
  return 4;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeStats(input: {
  words: StatWord[];
  units: StatUnit[];
  items: ReviewItemRow[];
  logs: ReviewLogRow[];
  states: Map<string, NodeState>;
  now: number;
}): Stats {
  const { words, units, items, logs, states, now } = input;
  const item = new Map(items.map((r) => [r.id, r]));

  // HSK coverage
  const coverage: HskCoverage[] = [1, 2, 3].map((level) => {
    const ws = words.filter((w) => w.hsk === level);
    const known = ws.filter((w) => isKnown(item.get(w.id))).length;
    const learning = ws.filter((w) => item.has(w.id) && !isKnown(item.get(w.id))).length;
    return { level, total: ws.length, known, learning };
  });
  const wordIds = new Set(words.map((w) => w.id));
  const wordsSeen = items.filter((r) => wordIds.has(r.id)).length;
  const wordsKnown = items.filter((r) => wordIds.has(r.id) && isKnown(r)).length;

  // Due reviews
  const today = startOfDay(now);
  const dueNow = items.filter((r) => r.due <= now).length;
  const forecast = Array.from({ length: 7 }, (_, d) => {
    const from = d === 0 ? now : today + d * DAY;
    const to = today + (d + 1) * DAY;
    return items.filter((r) => r.due > from && r.due <= to).length;
  });

  // Tones: per-syllable comparison of expected and given tones.
  // Accuracy uses tone-id answers (always logged); mix-ups also use typed answers with wrong tones.
  const toneMap = new Map<number, ToneStat>([1, 2, 3, 4, 5].map((t) => [t, { tone: t, attempts: 0, right: 0 }]));
  const conf = new Map<string, number>();
  for (const l of logs) {
    if (!l.tones) continue;
    const exp = l.tones.expected.split('-').map(Number);
    const giv = l.tones.given.split('-').map(Number);
    exp.forEach((e, i) => {
      const g = giv[i];
      if (!toneMap.has(e) || !g) return; // no tone typed: not a mix-up
      const right = g === e || (e === 3 && exp[i + 1] === 3 && g === 2);
      if (l.exercise === 'tone-id') {
        const s = toneMap.get(e)!;
        s.attempts++;
        if (right) s.right++;
      }
      if (!right) conf.set(`${e}-${g}`, (conf.get(`${e}-${g}`) ?? 0) + 1);
    });
  }
  const confusions = [...conf.entries()]
    .map(([k, count]) => {
      const [expected, given] = k.split('-').map(Number);
      return { expected, given, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Most missed
  const recent = logs.filter((l) => l.at > now - 60 * DAY);
  const tally = new Map<string, { wrong: number; total: number }>();
  for (const l of recent) {
    const t = tally.get(l.itemId) ?? { wrong: 0, total: 0 };
    t.total++;
    if (l.verdict === 'wrong') t.wrong++;
    tally.set(l.itemId, t);
  }
  const missed = [...tally.entries()]
    .filter(([, t]) => t.wrong > 0)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total)
    .slice(0, 8);

  // Activity
  const activity = Array.from({ length: 14 }, (_, i) => {
    const from = today - (13 - i) * DAY;
    return logs.filter((l) => l.at >= from && l.at < from + DAY).length;
  });

  const unitStats = units.map((u) => {
    const ns = u.nodes.map((id) => states.get(id));
    return {
      id: u.id,
      title: u.title,
      titleHanzi: u.titleHanzi,
      hsk: u.hsk,
      done: ns.filter((s) => s?.status === 'done').length,
      total: u.nodes.length,
      mastery: ns.reduce((n, s) => n + (s?.mastery ?? 0), 0),
    };
  });

  return {
    level: currentLevel(coverage),
    coverage,
    wordsKnown,
    wordsSeen,
    dueNow,
    forecast,
    tones: [...toneMap.values()],
    confusions,
    missed,
    activity,
    units: unitStats,
  };
}
