/**
 * Placement (CLAUDE.md §3.3): a short listening + pinyin test, or a chosen
 * starting level, marks words you already know as mature so you aren't
 * drilled on basics. Pure helpers plus the write to the database.
 */
import { isNeutralParticle } from '../../lib/context';
import { db, type ReviewItemRow } from '../../db/db';
import { cardId, TEXT_FACETS } from '../../lib/review';
import type { VocabRow } from '../../lib/vocabData';
import { distractors } from '../session/plan';

export const PER_LEVEL = 8;
export const PASS_LEVEL = 0.8;
export const STOP_BELOW = 0.5;
export const LEVELS = [1, 2, 3, 4, 5, 6];

const playable = (w: VocabRow) => w.azure || !!w.course;
/** Never dictate a neutral-tone particle on its own (le, de, ne…): it's only meaningful in a sentence. */
const dictatable = (w: VocabRow) => playable(w) && !isNeutralParticle(w);

/** Words to test at a level: spread evenly over its frequency order, so the score stands for the level. */
export function sampleLevel(words: VocabRow[], level: number, n = PER_LEVEL): VocabRow[] {
  const pool = words.filter((w) => w.level === level && dictatable(w) && [...w.hanzi].length <= 3).sort((a, b) => a.order - b.order);
  if (pool.length <= n) return pool;
  return Array.from({ length: n }, (_, i) => pool[Math.floor(((i + 0.5) / n) * pool.length)]);
}

/**
 * The meaning question after a right dictation: the word and three others that
 * don't share its meaning or its sound, shuffled. Ids, in display order.
 */
export function meaningOptions(w: VocabRow, words: VocabRow[], rng: () => number = Math.random): string[] {
  const ids = [w.id, ...distractors(w, words, rng, 3)];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export interface LevelResult {
  level: number;
  asked: number;
  right: number;
}

/** Carry on to the next level only if this one went reasonably well. */
export function shouldContinue(r: LevelResult): boolean {
  return r.asked > 0 && r.right / r.asked >= STOP_BELOW;
}

/**
 * Which words to mark as known: every word of a level you got 80%+ on; for the
 * first level below that, the most common share of it matching your score;
 * and every word you answered right in the test.
 */
export function knownFromResults(words: VocabRow[], results: LevelResult[], rightWords: Set<string>): string[] {
  const out = new Set(rightWords);
  for (const r of [...results].sort((a, b) => a.level - b.level)) {
    const level = words.filter((w) => w.level === r.level).sort((a, b) => a.order - b.order);
    const rate = r.asked ? r.right / r.asked : 0;
    if (rate >= PASS_LEVEL) {
      level.forEach((w) => out.add(w.id));
      continue;
    }
    level.slice(0, Math.round(rate * level.length)).forEach((w) => out.add(w.id));
    break;
  }
  return [...out];
}

/** Starting level chosen by hand: every word below it counts as known. */
export function knownBelow(words: VocabRow[], level: number): string[] {
  return words.filter((w) => w.level >= 1 && w.level < level).map((w) => w.id);
}

/**
 * Pure: mature cards (listening and typing) for known words, due spread over
 * the next 3 to 9 weeks so they don't all come back on one day. A card that's
 * already further along is left alone.
 */
export function matureCards(words: string[], existing: Map<string, ReviewItemRow>, now: number, rng: () => number = Math.random): ReviewItemRow[] {
  const out: ReviewItemRow[] = [];
  for (const word of words) {
    for (const facet of TEXT_FACETS) {
      const id = cardId(word, facet);
      const cur = existing.get(id);
      if (cur && cur.state === 2 && cur.scheduledDays >= 21) continue;
      const days = 21 + Math.floor(rng() * 43);
      out.push({
        id,
        word,
        facet,
        due: now + days * 864e5,
        stability: days,
        difficulty: 4,
        elapsedDays: 0,
        scheduledDays: days,
        learningSteps: 0,
        reps: Math.max(1, cur?.reps ?? 0),
        lapses: cur?.lapses ?? 0,
        state: 2,
        lastReview: now,
        migratedFrom: 'placement',
        updatedAt: now,
      });
    }
  }
  return out;
}

export async function markKnown(words: string[], now = Date.now()): Promise<number> {
  const existing = new Map((await db.reviewItems.toArray()).map((c) => [c.id, c]));
  const rows = matureCards(words, existing, now);
  for (let i = 0; i < rows.length; i += 2000) await db.reviewItems.bulkPut(rows.slice(i, i + 2000));
  return new Set(rows.map((r) => r.word)).size;
}
