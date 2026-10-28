/**
 * Spaced repetition glue for sessions, Conversations lessons and role-play. The engine itself
 * (facet cards, grading, queue, log) lives in ./review.ts.
 *
 * An answer about a course word updates that word's card for the skill the
 * exercise trains (w-ni in a dictation → <ni3 id>#lp). Sentences keep one card each.
 */
import { db, uuid, type ReviewItemRow, type ReviewLogRow } from '../db/db';
import type { Verdict } from './pinyinAnswer';
import {
  autoGrade,
  cardId,
  facetForExercise,
  introduceWord,
  newWordId,
  recordReview,
  regrade,
  review,
  type AnswerInfo,
  type RatingName,
} from './review';
import { currentSettings } from './settings';

export { cardFromRow, rowFromCard } from './review';

/** Pure: next card state after an answer (kept for tests and simple callers). */
export function schedule(prev: ReviewItemRow | undefined, id: string, verdict: Verdict, now: number): ReviewItemRow {
  return review(prev, id, autoGrade(verdict), now).row;
}

export interface RecordedAnswer {
  /** The card that was updated, if any (for changing the grade afterwards). */
  card?: string;
  rating?: RatingName;
}

/** Persist an answer: update the matching card and append a full log entry. */
export async function recordAnswer(
  itemId: string,
  verdict: Verdict,
  info: { exercise: string; nodeId?: string; tones?: ReviewLogRow['tones'] } & AnswerInfo,
  now = Date.now(),
): Promise<RecordedAnswer> {
  const s = currentSettings();
  const word = newWordId(itemId);
  const ctx = { exercise: info.exercise, nodeId: info.nodeId, tones: info.tones, verdict, itemId, ms: info.ms };
  if (word) {
    if (info.exercise === 'intro') await introduceWord(word, now);
    const facet = facetForExercise(info.exercise);
    if (!facet) {
      // Recognition or intro: logged, but no card changes.
      await db.reviewLogs.add({ id: uuid(), itemId, verdict, at: now, exercise: info.exercise, nodeId: info.nodeId, tones: info.tones, ms: info.ms, updatedAt: now });
      return {};
    }
    const id = cardId(word, facet);
    const rating = autoGrade(verdict, info);
    await recordReview(id, rating, ctx, s.retention, now);
    return { card: id, rating };
  }
  const rating = autoGrade(verdict, info);
  await recordReview(itemId, rating, ctx, s.retention, now);
  return { card: itemId, rating };
}

/** Change the grade of the latest review of these cards (the grade buttons after an answer). */
export async function regradeAll(cards: string[], rating: RatingName): Promise<void> {
  const r = currentSettings().retention;
  for (const c of cards) await regrade(c, rating, r);
}

/**
 * Record an answer in a session: updates the card if there is one (facet or
 * sentence card) and always logs it, with the XP it earned.
 */
export async function recordSessionAnswer(a: {
  card?: string | null;
  itemId: string;
  verdict: Verdict;
  /** A self-grade or override; otherwise auto-graded from the verdict and time. */
  rating?: RatingName;
  exercise: string;
  ms?: number;
  typed?: boolean;
  syllables?: number;
  tones?: ReviewLogRow['tones'];
  xp: number;
  now?: number;
}): Promise<RecordedAnswer> {
  const now = a.now ?? Date.now();
  const ctx = { exercise: a.exercise, tones: a.tones, verdict: a.verdict, itemId: a.itemId, ms: a.ms, xp: a.xp };
  if (a.card) {
    const rating = a.rating ?? autoGrade(a.verdict, { ms: a.ms, typed: a.typed, syllables: a.syllables });
    await recordReview(a.card, rating, ctx, currentSettings().retention, now);
    return { card: a.card, rating };
  }
  await db.reviewLogs.add({ id: uuid(), itemId: a.itemId, verdict: a.verdict, at: now, exercise: a.exercise, tones: a.tones, ms: a.ms, xp: a.xp, updatedAt: now });
  return {};
}
