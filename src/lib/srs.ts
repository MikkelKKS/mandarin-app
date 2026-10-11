/**
 * Spaced repetition (FSRS via ts-fsrs). Pure helpers + Dexie persistence.
 * Each word and sentence has one card; every answer updates it.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import { db, uuid, type ReviewItemRow, type ReviewLogRow } from '../db/db';
import type { Verdict } from './pinyinAnswer';

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));

export function gradeFor(v: Verdict): Grade {
  switch (v) {
    case 'correct':
    case 'typo':
      return Rating.Good;
    case 'almost':
      return Rating.Hard;
    default:
      return Rating.Again;
  }
}

export function cardFromRow(r: ReviewItemRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsedDays,
    scheduled_days: r.scheduledDays,
    learning_steps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.lastReview ? new Date(r.lastReview) : undefined,
  };
}

export function rowFromCard(id: string, c: Card, now: number): ReviewItemRow {
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
    updatedAt: now,
  };
}

/** Pure: next card state after an answer. */
export function schedule(prev: ReviewItemRow | undefined, id: string, verdict: Verdict, now: number): ReviewItemRow {
  const card = prev ? cardFromRow(prev) : createEmptyCard(new Date(now));
  const next = scheduler.next(card, new Date(now), gradeFor(verdict)).card;
  return rowFromCard(id, next, now);
}

/** Persist an answer: update the card and append to the log. */
export async function recordAnswer(
  itemId: string,
  verdict: Verdict,
  info: { exercise: string; nodeId?: string; tones?: ReviewLogRow['tones'] },
  now = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.reviewItems, db.reviewLogs, async () => {
    const prev = await db.reviewItems.get(itemId);
    await db.reviewItems.put(schedule(prev, itemId, verdict, now));
    await db.reviewLogs.add({ id: uuid(), itemId, verdict, at: now, exercise: info.exercise, nodeId: info.nodeId, tones: info.tones, updatedAt: now });
  });
}

/** Pure: choose items for a practice session. */
export function choosePractice(
  items: ReviewItemRow[],
  logs: Pick<ReviewLogRow, 'itemId' | 'verdict' | 'at'>[],
  now: number,
  limit = 8,
): string[] {
  const due = items.filter((i) => i.due <= now).sort((a, b) => a.due - b.due).map((i) => i.id);
  // Recent mistakes (last 7 days) that haven't been answered correctly since.
  const lastByItem = new Map<string, { verdict: Verdict; at: number }>();
  for (const l of [...logs].sort((a, b) => a.at - b.at)) lastByItem.set(l.itemId, l);
  const weekAgo = now - 7 * 864e5;
  const mistakes = [...lastByItem.entries()]
    .filter(([, l]) => l.verdict === 'wrong' && l.at >= weekAgo)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id]) => id);
  const chosen: string[] = [];
  for (const id of [...mistakes.slice(0, Math.ceil(limit / 2)), ...due, ...mistakes]) {
    if (!chosen.includes(id)) chosen.push(id);
    if (chosen.length >= limit) break;
  }
  if (chosen.length < limit) {
    // Fill with the weakest known items so Practice is never empty once you've started.
    const weakest = [...items].sort((a, b) => a.stability - b.stability).map((i) => i.id);
    for (const id of weakest) {
      if (!chosen.includes(id)) chosen.push(id);
      if (chosen.length >= limit) break;
    }
  }
  return chosen;
}

export async function practiceItems(now = Date.now(), limit = 8): Promise<string[]> {
  const [items, logs] = await Promise.all([db.reviewItems.toArray(), db.reviewLogs.where('at').above(now - 7 * 864e5).toArray()]);
  return choosePractice(items, logs, now, limit);
}

export async function dueCount(now = Date.now()): Promise<number> {
  return db.reviewItems.where('due').belowOrEqual(now).count();
}
