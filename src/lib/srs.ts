/**
 * Spaced repetition glue for the lessons, role-play and games. The engine itself
 * (facet cards, grading, queue, log) lives in ./review.ts.
 *
 * An answer about a course word updates that word's card for the skill the
 * exercise trains (w-ni in a dictation → <ni3 id>#lp). Sentences keep one card each.
 */
import legacyMap from 'virtual:vocab-legacy';
import { db, uuid, type ReviewItemRow, type ReviewLogRow } from '../db/db';
import type { Verdict } from './pinyinAnswer';
import {
  autoGrade,
  cardId,
  facetForExercise,
  introduceWord,
  newWordId,
  parseCardId,
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

/** New word id → old course id, so Practice can still build exercises from course content. */
const courseIdOf = new Map<string, string>();
for (const [legacy, word] of Object.entries(legacyMap)) if (!courseIdOf.has(word)) courseIdOf.set(word, legacy);

/** True for an old course word card that has been replaced by facet cards. */
export function isSuperseded(id: string): boolean {
  return !id.includes('#') && !!legacyMap[id];
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

/** Course item id for a card (facet cards map back to their course word). */
function courseItem(id: string): string | null {
  const p = parseCardId(id);
  if (!p) return isSuperseded(id) ? null : id;
  if (p.facet === 'sp' && !currentSettings().speaking) return null;
  return courseIdOf.get(p.word) ?? null;
}

/** Pure: choose items for a practice session. */
export function choosePractice(
  items: ReviewItemRow[],
  logs: Pick<ReviewLogRow, 'itemId' | 'verdict' | 'at'>[],
  now: number,
  limit = 8,
): string[] {
  const due = items.filter((i) => i.due <= now).sort((a, b) => a.due - b.due).map((i) => i.id);
  // (Ids here are course ids: facet cards have been mapped back by the caller.)
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
  const [cards, logs] = await Promise.all([db.reviewItems.toArray(), db.reviewLogs.where('at').above(now - 7 * 864e5).toArray()]);
  // Facet cards stand in for their course word; keep the most urgent card per word.
  const byItem = new Map<string, ReviewItemRow>();
  for (const c of cards) {
    const id = courseItem(c.id);
    if (!id) continue;
    const cur = byItem.get(id);
    if (!cur || c.due < cur.due || (c.due === cur.due && c.stability < cur.stability)) byItem.set(id, { ...c, id });
  }
  return choosePractice([...byItem.values()], logs, now, limit);
}

/** Cards due now (old course word cards, replaced by facets, don't count; nor speaking with the mic off). */
export async function dueCount(now = Date.now()): Promise<number> {
  const due = await db.reviewItems.where('due').belowOrEqual(now).toArray();
  const mic = currentSettings().speaking;
  return due.filter((c) => !isSuperseded(c.id) && c.state !== 0 && (mic || !c.id.endsWith('#sp'))).length;
}

/**
 * Cards keyed by course id, for screens built on the course (Progress, Games):
 * a word's facet cards collapse into one row (its weakest listening/typing card),
 * and old course word cards are dropped once their facets exist.
 */
export function courseCards(items: ReviewItemRow[]): ReviewItemRow[] {
  const out = new Map<string, ReviewItemRow>();
  const hasFacets = new Set<string>();
  for (const c of items) {
    const p = parseCardId(c.id);
    if (!p || p.facet === 'sp') continue;
    const id = courseIdOf.get(p.word);
    if (!id) continue;
    hasFacets.add(id);
    const cur = out.get(id);
    if (!cur || c.stability < cur.stability) out.set(id, { ...c, id });
  }
  for (const c of items) if (!c.id.includes('#') && !hasFacets.has(c.id)) out.set(c.id, c);
  return [...out.values()];
}

/** Change the grade of the latest review of these cards (the grade buttons after an answer). */
export async function regradeAll(cards: string[], rating: RatingName): Promise<void> {
  const r = currentSettings().retention;
  for (const c of cards) await regrade(c, rating, r);
}
