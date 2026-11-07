/**
 * A lived-in profile for design screenshots (qa/design.spec.ts): about six weeks of daily study
 * simulated with the real FSRS scheduler, so Home, Stats, the session end and the tone matrix
 * look like the app Mikkel actually uses instead of a brand-new account.
 *
 * Deterministic (seeded random, no fuzz) and anchored to the start of today, so two builds
 * screenshotted on the same day get the same data and before/after shots compare fairly.
 * Shape follows `ReviewItemRow` / `ReviewLogRow` in src/db/db.ts and `rowFromCard` in src/lib/review.ts.
 */
import { readFileSync } from 'node:fs';
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';

type Row = Record<string, unknown>;
interface Word {
  id: string;
  numeric: string;
  level: number;
  order: number;
}

const DAY = 864e5;
/** Days ago with no study: an older break and one saved by a streak freeze, so the calendar has texture. */
const SKIPPED = new Set([31, 24, 23]);
const DAYS = 42;
const NEW_PER_DAY = 9;
const GOAL = 100;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tonesOf = (w: Word) => w.numeric.split(' ').map((s) => (/[1-5]$/.test(s) ? s.slice(-1) : '5'));

/** A typical learner's tone slip: 2↔3 most of all, then 3→4 and 1↔4. */
function slip(t: string, r: () => number): string {
  const x = r();
  switch (t) {
    case '2':
      return x < 0.75 ? '3' : '1';
    case '3':
      return x < 0.6 ? '2' : '4';
    case '4':
      return x < 0.6 ? '1' : '3';
    case '1':
      return x < 0.7 ? '4' : '2';
    default:
      return x < 0.5 ? '1' : '4';
  }
}

function row(id: string, c: Card, now: number, word: string, facet: string): Row {
  return {
    id,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review?.getTime(),
    word,
    facet,
    updatedAt: now,
  };
}

export function demoProfile(now = Date.now()): { items: Row[]; logs: Row[]; sessions: Row } {
  const r = rng(20261107);
  const f = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));
  const words = (JSON.parse(readFileSync('content/data/words.json', 'utf8')) as Word[])
    .filter((w) => w.level <= 2)
    .sort((a, b) => a.level - b.level || a.order - b.order);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const cards = new Map<string, { card: Card; word: Word; facet: string }>();
  const logs: Row[] = [];
  let next = 0;
  let n = 0;
  const log = (at: number, l: Row) => logs.push({ id: `demo-${n++}`, at, updatedAt: at, ...l });

  for (let ago = DAYS; ago >= 0; ago--) {
    if (SKIPPED.has(ago)) continue;
    const start = today.getTime() - ago * DAY + (18 + Math.floor(r() * 4)) * 3600e3;
    // Today is half done: the goal ring shows progress and the streak is still alive from yesterday.
    const budget = ago === 0 ? 60 : GOAL + 20 + Math.floor(r() * 90);
    let t = start;
    let xp = 0;
    const answer = (key: string, exercise: string, pRight: number) => {
      const c = cards.get(key)!;
      const right = r() < pRight;
      const almost = !right && c.facet !== 'lm' && r() < 0.35;
      const verdict = right ? 'correct' : almost ? 'almost' : 'wrong';
      const rating: Grade = right ? (r() < 0.12 ? Rating.Hard : Rating.Good) : almost ? Rating.Hard : Rating.Again;
      const expected = tonesOf(c.word);
      const given = right ? expected : expected.map((x, i) => (i === Math.floor(r() * expected.length) || expected.length === 1 ? slip(x, r) : x));
      const before = c.card;
      const elapsed = before.last_review ? (t - before.last_review.getTime()) / DAY : 0;
      const after = f.next(before, new Date(t), rating).card;
      c.card = after;
      const gain = right ? 10 : almost ? 5 : 2;
      xp += gain;
      log(t, {
        itemId: c.word.id,
        card: key,
        exercise,
        verdict,
        rating,
        stateBefore: before.state,
        elapsedDays: Math.round(elapsed * 1000) / 1000,
        scheduledDays: after.scheduled_days,
        stabilityAfter: Math.round(after.stability * 1000) / 1000,
        ms: 1800 + Math.floor(r() * 7000),
        xp: gain,
        ...(c.facet === 'lm' ? {} : { tones: { expected: expected.join('-'), given: given.join('-') } }),
      });
      t += 15_000 + Math.floor(r() * 30_000);
    };
    // Due reviews first, then new words, as in a real session.
    const due = [...cards.entries()].filter(([, c]) => c.card.due.getTime() <= start + 3600e3).map(([k]) => k);
    for (const k of due) {
      if (xp >= budget) break;
      const facet = cards.get(k)!.facet;
      answer(k, facet === 'lm' ? 'listen-meaning' : facet === 'lp' ? 'dictation' : 'meaning-pinyin', facet === 'lm' ? 0.9 : facet === 'lp' ? 0.8 : 0.76);
    }
    for (let i = 0; i < (ago === 0 ? 2 : NEW_PER_DAY) && next < words.length; i++) {
      const w = words[next++];
      log(t, { itemId: w.id, exercise: 'intro', verdict: 'correct', xp: 5 });
      xp += 5;
      for (const facet of ['lm', 'lp', 'mp']) cards.set(`${w.id}#${facet}`, { card: createEmptyCard(new Date(t)), word: w, facet });
      answer(`${w.id}#lm`, 'listen-meaning', 0.92);
    }
  }
  const items = [...cards.entries()].map(([k, c]) => row(k, c.card, now, c.word.id, c.facet));
  // About one and a half sessions a study day (the session count drives the "sessions" badges).
  const sessions = { id: 'sessions', best: 320, plays: 58, updatedAt: now };
  return { items, logs, sessions };
}
