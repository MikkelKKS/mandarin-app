/**
 * The review engine (CLAUDE.md §3.1): FSRS cards per word and skill ("facet"),
 * auto-grading from answers, a full review log, and the daily queue.
 *
 * Card ids are `<word id>#<facet>`, stored in the same `reviewItems` table
 * (and Supabase table) as before, so sync needs no change. Sentences keep one
 * card each under their own id.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import legacyMap from 'virtual:vocab-legacy';
import { db, uuid, type ReviewItemRow, type ReviewLogRow } from '../db/db';
import type { Verdict } from './pinyinAnswer';

export type Facet = 'lm' | 'lp' | 'mp' | 'sp';
export const FACETS: Facet[] = ['lm', 'lp', 'mp', 'sp'];
export const FACET_LABEL: Record<Facet, string> = {
  lm: 'Listening → meaning',
  lp: 'Listening → pinyin',
  mp: 'Meaning → pinyin',
  sp: 'Speaking',
};
/** Facets every word gets when introduced. Speaking cards are made when speaking is first practised. */
export const TEXT_FACETS: Facet[] = ['lm', 'lp', 'mp'];

export type RatingName = 'again' | 'hard' | 'good' | 'easy';
export const RATING: Record<RatingName, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };

/** Reading cards (`#rp`, `#rm`, see lib/reading.ts) are scheduled on their own, outside the daily word queue. */
export const READING_CARD = /#r[pm]$/;

export function cardId(word: string, facet: Facet): string {
  return `${word}#${facet}`;
}

export function parseCardId(id: string): { word: string; facet: Facet } | null {
  const i = id.lastIndexOf('#');
  if (i < 0) return null;
  const facet = id.slice(i + 1) as Facet;
  return FACETS.includes(facet) ? { word: id.slice(0, i), facet } : null;
}

/** HSK 3.0 word id → its old course id (for the older recordings). */
const courseOf = new Map<string, string>();
for (const [legacy, word] of Object.entries(legacyMap)) if (!courseOf.has(word)) courseOf.set(word, legacy);
export function courseIdFor(word: string): string | undefined {
  return courseOf.get(word);
}

/** The HSK 3.0 word id for an old course word id (w-ni → ni3-xxxxx), if it has one. */
export function newWordId(legacyId: string): string | undefined {
  return legacyMap[legacyId];
}

/** Which facet an exercise trains, for a word item. null = it doesn't update a word card. */
export function facetForExercise(exercise: string): Facet | null {
  switch (exercise) {
    case 'listen-meaning':
    case 'listen-sentence':
    case 'what-would-you-say':
    case 'game:listening-blitz':
      return 'lm';
    case 'dictation':
    case 'tone-id':
    case 'listen-tiles':
    case 'game:tone-sort':
    case 'game:tone-pairs':
      return 'lp';
    case 'en-to-pinyin':
    case 'reply-type':
    case 'fill-gap':
    case 'build-sentence':
    case 'roleplay':
    case 'game:sentence-scramble':
    case 'game:measure-words':
      return 'mp';
    case 'repeat':
      return 'sp';
    default:
      // Character recognition (pairs, pick the character, read the sentence) is out of scope now.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Grading

export interface AnswerInfo {
  /** Time from seeing the question to answering, in ms. */
  ms?: number;
  /** Syllables in the answer, to judge what "slow" means. */
  syllables?: number;
  /** Typed (true) or multiple choice (false). */
  typed?: boolean;
  /** A hint was used (e.g. the text was revealed before answering). */
  hinted?: boolean;
}

/** Slower than this counts as "right but slow" (Hard). */
export function slowAfterMs(info: AnswerInfo): number {
  return info.typed ? 10_000 + 2_500 * Math.max(1, info.syllables ?? 1) : 12_000;
}

/** Auto-grade: wrong → Again; tone slip (lenient) → Hard; right but slow or with a hint → Hard; right → Good. */
export function autoGrade(verdict: Verdict, info: AnswerInfo = {}): RatingName {
  if (verdict === 'wrong') return 'again';
  if (verdict === 'almost') return 'hard';
  if (info.hinted) return 'hard';
  if (info.ms !== undefined && info.ms > slowAfterMs(info)) return 'hard';
  return 'good';
}

// ---------------------------------------------------------------------------
// Scheduling (pure)

const schedulers = new Map<number, ReturnType<typeof fsrs>>();
export function scheduler(retention = 0.9) {
  const r = Math.min(0.97, Math.max(0.7, retention));
  let s = schedulers.get(r);
  if (!s) {
    s = fsrs(generatorParameters({ enable_fuzz: true, request_retention: r }));
    schedulers.set(r, s);
  }
  return s;
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

export function rowFromCard(id: string, c: Card, now: number, extra: Partial<ReviewItemRow> = {}): ReviewItemRow {
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
    ...extra,
    updatedAt: now,
  };
}

/** A brand-new card for a word facet, due now. */
export function newCard(id: string, now: number): ReviewItemRow {
  const p = parseCardId(id);
  return rowFromCard(id, createEmptyCard(new Date(now)), now, p ? { word: p.word, facet: p.facet } : {});
}

/** Pure: the card after a review, and what the log should record. */
export function review(
  prev: ReviewItemRow | undefined,
  id: string,
  rating: RatingName,
  now: number,
  retention = 0.9,
): { row: ReviewItemRow; log: Pick<ReviewLogRow, 'card' | 'rating' | 'stateBefore' | 'elapsedDays' | 'scheduledDays' | 'stabilityAfter'> } {
  const before = prev ?? newCard(id, now);
  const card = cardFromRow(before);
  const elapsed = card.last_review ? Math.max(0, (now - card.last_review.getTime()) / 864e5) : 0;
  const next = scheduler(retention).next(card, new Date(now), RATING[rating]).card;
  const p = parseCardId(id);
  const row = rowFromCard(id, next, now, p ? { word: p.word, facet: p.facet } : {});
  return {
    row,
    log: {
      card: id,
      rating: RATING[rating],
      stateBefore: card.state,
      elapsedDays: Math.round(elapsed * 1000) / 1000,
      scheduledDays: next.scheduled_days,
      stabilityAfter: Math.round(next.stability * 1000) / 1000,
    },
  };
}

// ---------------------------------------------------------------------------
// Word state, for stats (new / learning / young / mature)

export type WordState = 'new' | 'learning' | 'young' | 'mature';
/** Mature = interval of 21 days or more (as in Anki). */
export const MATURE_DAYS = 21;

export function cardState(r: ReviewItemRow | undefined): WordState {
  if (!r || r.state === State.New) return 'new';
  if (r.state === State.Learning || r.state === State.Relearning) return 'learning';
  return r.scheduledDays >= MATURE_DAYS ? 'mature' : 'young';
}

const RANK: Record<WordState, number> = { new: 0, learning: 1, young: 2, mature: 3 };
/**
 * A word is as far along as its weakest listening/typing facet; once any facet
 * has been practised it counts as at least "learning" (a facet not met yet
 * doesn't make a word you've started "new" again).
 */
export function wordState(cards: Array<ReviewItemRow | undefined>): WordState {
  const states = cards.map(cardState);
  if (states.every((s) => s === 'new')) return 'new';
  if (states.some((s) => s === 'new')) return 'learning';
  return states.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));
}

// ---------------------------------------------------------------------------
// The daily queue (pure)

export interface QueueOptions {
  now: number;
  newPerDay: number;
  reviewsPerDay: number;
  /** Speaking cards are skipped (not failed, not shown) when the microphone is off. */
  mic: boolean;
  /** Already done today. */
  doneToday: { newWords: number; reviews: number };
}

export interface Queue {
  /** Due card ids, most overdue (relative to their interval) first. */
  reviews: string[];
  /** Word ids to introduce next, in learning order. */
  newWords: string[];
  /** Due cards left out by the daily cap. */
  overCap: number;
}

export function buildQueue(cards: ReviewItemRow[], wordsInOrder: string[], o: QueueOptions): Queue {
  const due = cards
    .filter((c) => c.due <= o.now && c.state !== State.New)
    .filter((c) => o.mic || !c.id.endsWith('#sp'))
    // Overdue relative to the interval: a 2-day card 2 days late before a 60-day card 2 days late.
    .map((c) => ({ id: c.id, late: (o.now - c.due) / 864e5 / Math.max(1, c.scheduledDays) }))
    .sort((a, b) => b.late - a.late);
  const reviewRoom = Math.max(0, o.reviewsPerDay - o.doneToday.reviews);
  const reviews = due.slice(0, reviewRoom).map((d) => d.id);

  const started = new Set<string>();
  for (const c of cards) {
    const p = parseCardId(c.id);
    if (p && (c.state !== State.New || c.reps > 0)) started.add(p.word);
  }
  const newRoom = Math.max(0, o.newPerDay - o.doneToday.newWords);
  const newWords: string[] = [];
  for (const w of wordsInOrder) {
    if (newWords.length >= newRoom) break;
    if (!started.has(w)) newWords.push(w);
  }
  return { reviews, newWords, overCap: due.length - reviews.length };
}

/** Pure: how many new words and reviews were done since the day started. */
export function doneSince(logs: Array<Pick<ReviewLogRow, 'card' | 'stateBefore' | 'at'>>, dayStart: number): { newWords: number; reviews: number } {
  const newWords = new Set<string>();
  let reviews = 0;
  for (const l of logs) {
    if (l.at < dayStart || !l.card || READING_CARD.test(l.card)) continue;
    const p = parseCardId(l.card);
    if (l.stateBefore === State.New) {
      if (p) newWords.add(p.word);
    } else reviews++;
  }
  return { newWords: newWords.size, reviews };
}

/** Local midnight, with the day rolling over at 4 am like Anki (late-night study counts for the evening). */
export function dayStart(now: number): number {
  const d = new Date(now - 4 * 3600e3);
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Migration of old course word cards onto facets

/**
 * Pure: facet cards to write for old course word cards (w-ni → <new id>#lm, #lp, #mp).
 * Idempotent: a facet is only (re)written when the old card is newer than it, so it
 * catches up with a device that still runs the old app, but never undoes a newer review.
 */
export function migrateLegacy(rows: ReviewItemRow[], map: Record<string, string> = legacyMap): ReviewItemRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ReviewItemRow[] = [];
  for (const r of rows) {
    if (r.id.includes('#')) continue;
    const word = map[r.id];
    if (!word) continue; // sentences and words outside the new list keep their own cards
    for (const facet of TEXT_FACETS) {
      const id = cardId(word, facet);
      const cur = byId.get(id);
      if (cur && cur.updatedAt >= r.updatedAt) continue;
      const row: ReviewItemRow = { ...r, id, word, facet, migratedFrom: r.id };
      out.push(row);
      byId.set(id, row);
    }
  }
  return out;
}

export async function runLegacyMigration(): Promise<number> {
  const rows = await db.reviewItems.toArray();
  const out = migrateLegacy(rows);
  if (out.length) await db.reviewItems.bulkPut(out);
  return out.length;
}

// ---------------------------------------------------------------------------
// Persistence

export interface ReviewContext {
  exercise: string;
  nodeId?: string;
  tones?: ReviewLogRow['tones'];
  verdict: Verdict;
  /** The item the exercise was about (course id), for older stats. Defaults to the card id. */
  itemId?: string;
  ms?: number;
  /** True when the grade was changed by hand. */
  override?: boolean;
  /** XP the answer earned (sessions). */
  xp?: number;
}

/** Undo information for the last review of each card, so a grade can be changed right after. */
const undo = new Map<string, { logId: string; prev: ReviewItemRow | undefined }>();

/** Record one review: update the card and append a full log entry. Returns the log id. */
export async function recordReview(id: string, rating: RatingName, ctx: ReviewContext, retention: number, now = Date.now()): Promise<string> {
  const logId = uuid();
  await db.transaction('rw', db.reviewItems, db.reviewLogs, async () => {
    const prev = await db.reviewItems.get(id);
    const r = review(prev, id, rating, now, retention);
    await db.reviewItems.put(r.row);
    await db.reviewLogs.add({
      id: logId,
      itemId: ctx.itemId ?? id,
      verdict: ctx.verdict,
      at: now,
      exercise: ctx.exercise,
      nodeId: ctx.nodeId,
      tones: ctx.tones,
      ms: ctx.ms,
      override: ctx.override || undefined,
      xp: ctx.xp,
      ...r.log,
      updatedAt: now,
    });
    undo.set(id, { logId, prev });
  });
  return logId;
}

/**
 * Change the grade of the most recent review of a card (the override buttons).
 * Restores the card as it was before that review and applies the new grade.
 * The original log entry is kept (logs are append-only) and marked as replaced.
 */
export async function regrade(id: string, rating: RatingName, retention: number, now = Date.now()): Promise<boolean> {
  const u = undo.get(id);
  if (!u) return false;
  const old = await db.reviewLogs.get(u.logId);
  if (!old) return false;
  const at = old.at;
  await db.transaction('rw', db.reviewItems, db.reviewLogs, async () => {
    const r = review(u.prev, id, rating, at, retention);
    await db.reviewItems.put({ ...r.row, updatedAt: now });
    await db.reviewLogs.update(u.logId, { replaced: true, updatedAt: now });
    const logId = uuid();
    await db.reviewLogs.add({ ...old, ...r.log, id: logId, override: true, replaced: undefined, updatedAt: now });
    undo.set(id, { logId, prev: u.prev });
  });
  return true;
}

/** Make the text-facet cards for a word the first time it's met (no grade yet). */
export async function introduceWord(word: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.reviewItems, async () => {
    for (const f of TEXT_FACETS) {
      const id = cardId(word, f);
      if (!(await db.reviewItems.get(id))) await db.reviewItems.put(newCard(id, now));
    }
  });
}

/**
 * "I don't know this word": put all of its cards back to new (not started), so
 * it's taught again as a new word. Used when placement or an old card marked a
 * word as known that isn't. Logged without a card, so it doesn't count against
 * retention. Returns how many cards were reset.
 */
export async function forgetWord(word: string, now = Date.now()): Promise<number> {
  let n = 0;
  await db.transaction('rw', db.reviewItems, db.reviewLogs, async () => {
    for (const f of FACETS) {
      const id = cardId(word, f);
      if (!(await db.reviewItems.get(id))) continue;
      await db.reviewItems.put({ ...newCard(id, now), migratedFrom: 'forgotten' });
      n++;
    }
    await db.reviewLogs.add({ id: uuid(), itemId: word, verdict: 'wrong', at: now, exercise: 'unknown', xp: 0, updatedAt: now });
  });
  return n;
}

/** Today's queue, from the local database and settings. */
export async function todaysQueue(
  wordsInOrder: string[],
  s: { newPerDay: number; reviewsPerDay: number; mic: boolean },
  now = Date.now(),
): Promise<Queue> {
  const start = dayStart(now);
  const [cards, logs] = await Promise.all([db.reviewItems.toArray(), db.reviewLogs.where('at').aboveOrEqual(start).toArray()]);
  return buildQueue(
    // Word facets, and sentence cards (course "s…-" and Tatoeba "t…" ids); old course word cards are superseded.
    cards.filter((c) => (c.id.includes('#') && !READING_CARD.test(c.id)) || /^(s\d*-|t\d+$)/.test(c.id)),
    wordsInOrder,
    { now, newPerDay: s.newPerDay, reviewsPerDay: s.reviewsPerDay, mic: s.mic, doneToday: doneSince(logs.filter((l) => !l.replaced), start) },
  );
}
