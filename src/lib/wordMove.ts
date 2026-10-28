/**
 * Moving words by hand between Not started / Learning / Young / Mature (the
 * HSK word list on the Stats page). Pure card building plus the write. Manual
 * moves aren't reviews, so they add nothing to the review log.
 */
import { db, type ReviewItemRow } from '../db/db';
import { matureCards } from '../features/placement/placement';
import { cardId, FACETS, newCard, review, TEXT_FACETS, type WordState } from './review';

const DAY = 864e5;

/** Pure: the cards to write so each word ends up in `to`. */
export function movedCards(
  words: string[],
  to: WordState,
  existing: Map<string, ReviewItemRow>,
  now: number,
  rng: () => number = Math.random,
  retention = 0.9,
): ReviewItemRow[] {
  const out: ReviewItemRow[] = [];
  if (to === 'mature') {
    // Every listening/typing card at least 21 days out (cards already there are kept).
    return matureCards(words, existing, now, rng).map((r) => ({ ...r, migratedFrom: 'manual' }));
  }
  for (const word of words) {
    if (to === 'new') {
      // Back to not started: every card that exists, speaking included.
      for (const f of FACETS) {
        const id = cardId(word, f);
        if (existing.has(id)) out.push({ ...newCard(id, now), migratedFrom: 'manual' });
      }
      continue;
    }
    for (const f of TEXT_FACETS) {
      const id = cardId(word, f);
      if (to === 'learning') {
        // As if just answered "Again" for the first time: due again within minutes.
        out.push({ ...review(undefined, id, 'again', now, retention).row, migratedFrom: 'manual' });
      } else {
        // Young: in review, due in 3 to 14 days.
        const cur = existing.get(id);
        const days = 3 + Math.floor(rng() * 12);
        out.push({
          ...newCard(id, now),
          due: now + days * DAY,
          stability: days,
          difficulty: 5,
          scheduledDays: days,
          reps: Math.max(1, cur?.reps ?? 0),
          lapses: cur?.lapses ?? 0,
          state: 2,
          lastReview: now,
          migratedFrom: 'manual',
        });
      }
    }
  }
  return out;
}

export async function moveWords(words: string[], to: WordState, retention: number, now = Date.now()): Promise<void> {
  const existing = new Map((await db.reviewItems.toArray()).map((c) => [c.id, c]));
  const rows = movedCards(words, to, existing, now, Math.random, retention);
  for (let i = 0; i < rows.length; i += 2000) await db.reviewItems.bulkPut(rows.slice(i, i + 2000));
}
