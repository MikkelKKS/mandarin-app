import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import legacyMap from 'virtual:vocab-legacy';
import { db, type ReviewItemRow } from '../db/db';
import {
  autoGrade,
  buildQueue,
  cardId,
  cardState,
  dayStart,
  doneSince,
  facetForExercise,
  migrateLegacy,
  newCard,
  parseCardId,
  recordReview,
  regrade,
  review,
  wordState,
} from './review';
import { courseCards, recordAnswer } from './srs';

const DAY = 864e5;
const t0 = Date.UTC(2026, 9, 1, 10);

/** A card after `n` good reviews, each on its due date. */
function matured(id: string, n: number, start = t0): ReviewItemRow {
  let row = review(undefined, id, 'good', start).row;
  for (let i = 1; i < n; i++) row = review(row, id, 'good', row.due + 1000).row;
  return row;
}

describe('card ids and facets', () => {
  it('round-trips card ids', () => {
    expect(cardId('ni3-abcde', 'lp')).toBe('ni3-abcde#lp');
    expect(parseCardId('ni3-abcde#lp')).toEqual({ word: 'ni3-abcde', facet: 'lp' });
    expect(parseCardId('s-nihao')).toBeNull();
  });
  it('maps exercises to the skill they train', () => {
    expect(facetForExercise('listen-meaning')).toBe('lm');
    expect(facetForExercise('dictation')).toBe('lp');
    expect(facetForExercise('en-to-pinyin')).toBe('mp');
    expect(facetForExercise('repeat')).toBe('sp');
    expect(facetForExercise('pick-character')).toBeNull();
  });
  it('knows the new id of old course words', () => {
    expect(legacyMap['w-ni']).toMatch(/^ni3-[a-z0-9]{5}$/);
  });
});

describe('auto-grading', () => {
  it('grades wrong, tone slips, slow and right answers', () => {
    expect(autoGrade('wrong')).toBe('again');
    expect(autoGrade('almost')).toBe('hard');
    expect(autoGrade('correct')).toBe('good');
    expect(autoGrade('typo')).toBe('good');
    expect(autoGrade('correct', { hinted: true })).toBe('hard');
    expect(autoGrade('correct', { ms: 30_000, typed: false })).toBe('hard');
    expect(autoGrade('correct', { ms: 11_000, typed: false })).toBe('good');
    // Typing a long sentence gets more time.
    expect(autoGrade('correct', { ms: 25_000, typed: true, syllables: 8 })).toBe('good');
    expect(autoGrade('correct', { ms: 25_000, typed: true, syllables: 2 })).toBe('hard');
  });
  it('orders intervals Again < Hard < Good < Easy', () => {
    const base = matured('x#lm', 4);
    const t = base.due + 1000;
    const iv = (['again', 'hard', 'good', 'easy'] as const).map((r) => review(base, 'x#lm', r, t).row.due);
    expect(iv[0]).toBeLessThan(iv[1]);
    expect(iv[1]).toBeLessThan(iv[2]);
    expect(iv[2]).toBeLessThan(iv[3]);
  });
  it('schedules further out for a lower target retention', () => {
    const base = matured('x#lm', 4);
    const t = base.due + 1000;
    expect(review(base, 'x#lm', 'good', t, 0.85).row.due).toBeGreaterThan(review(base, 'x#lm', 'good', t, 0.95).row.due);
  });
  it('logs what the optimiser needs', () => {
    const base = matured('x#lp', 3);
    const t = base.due + 2 * DAY;
    const { log } = review(base, 'x#lp', 'hard', t);
    expect(log).toMatchObject({ card: 'x#lp', rating: 2, stateBefore: 2 });
    expect(log.elapsedDays).toBeGreaterThan(2);
    expect(log.scheduledDays).toBeGreaterThan(0);
  });
});

describe('word states', () => {
  it('goes new → learning → young → mature', () => {
    expect(cardState(undefined)).toBe('new');
    expect(cardState(newCard('w#lm', t0))).toBe('new');
    expect(cardState(review(undefined, 'w#lm', 'good', t0).row)).toBe('learning');
    expect(cardState(matured('w#lm', 3))).toBe('young');
    expect(cardState(matured('w#lm', 8))).toBe('mature');
  });
  it('takes the weakest facet for the word', () => {
    expect(wordState([matured('w#lm', 8), matured('w#lp', 3)])).toBe('young');
    expect(wordState([undefined, undefined])).toBe('new');
  });
});

describe('daily queue', () => {
  const words = ['a', 'b', 'c', 'd', 'e'];
  const due = (id: string, daysLate: number, interval = 1): ReviewItemRow => ({
    ...matured(id, 2),
    due: t0 - daysLate * DAY,
    scheduledDays: interval,
  });

  it('puts due reviews first, most overdue for their interval first', () => {
    const cards = [due('a#lm', 2, 60), due('b#lm', 2, 2), due('c#lp', 0.5, 1)];
    const q = buildQueue(cards, words, { now: t0, newPerDay: 0, reviewsPerDay: 100, mic: true, doneToday: { newWords: 0, reviews: 0 } });
    expect(q.reviews).toEqual(['b#lm', 'c#lp', 'a#lm']);
  });
  it('respects the daily caps and what was done today', () => {
    const cards = [due('a#lm', 1), due('b#lm', 1), due('c#lm', 1)];
    const q = buildQueue(cards, words, { now: t0, newPerDay: 3, reviewsPerDay: 2, mic: true, doneToday: { newWords: 1, reviews: 1 } });
    expect(q.reviews).toHaveLength(1);
    expect(q.overCap).toBe(2);
    expect(q.newWords).toEqual(['d', 'e']); // a, b, c are started; 3 − 1 done = 2 new
  });
  it('skips speaking cards when the microphone is off', () => {
    const cards = [due('a#sp', 1), due('a#lm', 1)];
    const off = buildQueue(cards, words, { now: t0, newPerDay: 0, reviewsPerDay: 9, mic: false, doneToday: { newWords: 0, reviews: 0 } });
    expect(off.reviews).toEqual(['a#lm']);
    const on = buildQueue(cards, words, { now: t0, newPerDay: 0, reviewsPerDay: 9, mic: true, doneToday: { newWords: 0, reviews: 0 } });
    expect(on.reviews).toHaveLength(2);
  });
  it('treats introduced but unreviewed words as not started, and not due', () => {
    const q = buildQueue([newCard('a#lm', t0 - DAY)], words, { now: t0, newPerDay: 2, reviewsPerDay: 9, mic: true, doneToday: { newWords: 0, reviews: 0 } });
    expect(q.reviews).toEqual([]);
    expect(q.newWords).toEqual(['a', 'b']);
  });
  it('counts new words and reviews done since the day started', () => {
    const start = dayStart(t0);
    const logs = [
      { card: 'a#lm', stateBefore: 0, at: start + 1 },
      { card: 'a#lp', stateBefore: 0, at: start + 2 },
      { card: 'b#lm', stateBefore: 2, at: start + 3 },
      { card: 'c#lm', stateBefore: 2, at: start - 1 },
    ];
    expect(doneSince(logs, start)).toEqual({ newWords: 1, reviews: 1 });
  });
  it('rolls the day over at 4 am', () => {
    const lateNight = new Date(2026, 9, 2, 2, 0).getTime();
    expect(new Date(dayStart(lateNight)).getDate()).toBe(1);
    expect(new Date(dayStart(new Date(2026, 9, 2, 5, 0).getTime())).getDate()).toBe(2);
  });
});

describe('moving old course cards onto facets', () => {
  const map = { 'w-ni': 'ni3-aaaaa' };
  it('copies an old word card onto the listening and typing facets', () => {
    const old = { ...matured('w-ni', 4), updatedAt: t0 };
    const out = migrateLegacy([old], map);
    expect(out.map((r) => r.id).sort()).toEqual(['ni3-aaaaa#lm', 'ni3-aaaaa#lp', 'ni3-aaaaa#mp']);
    expect(out[0]).toMatchObject({ stability: old.stability, due: old.due, word: 'ni3-aaaaa', migratedFrom: 'w-ni', updatedAt: t0 });
  });
  it('is idempotent and never undoes a newer review', () => {
    const old = { ...matured('w-ni', 4), updatedAt: t0 };
    const once = migrateLegacy([old], map);
    expect(migrateLegacy([old, ...once], map)).toEqual([]);
    const newer = { ...once[0], stability: 99, updatedAt: t0 + DAY };
    const again = migrateLegacy([old, newer, ...once.slice(1)], map);
    expect(again).toEqual([]);
    // A later answer on an old device (newer old card) is carried over.
    const later = { ...old, stability: 7, updatedAt: t0 + 2 * DAY };
    expect(migrateLegacy([later, newer, ...once.slice(1)], map).map((r) => r.stability)).toEqual([7, 7, 7]);
  });
  it('leaves sentences alone', () => {
    expect(migrateLegacy([{ ...matured('s-nihao', 2), updatedAt: t0 }], map)).toEqual([]);
  });
});

describe('recording and changing grades', () => {
  beforeEach(async () => {
    await db.reviewItems.clear();
    await db.reviewLogs.clear();
  });

  it('updates the facet card for the exercise and logs it in full', async () => {
    const r = await recordAnswer('w-ni', 'correct', { exercise: 'dictation', ms: 3000, typed: true, syllables: 1 }, t0);
    expect(r).toEqual({ card: `${legacyMap['w-ni']}#lp`, rating: 'good' });
    const card = await db.reviewItems.get(r.card!);
    expect(card?.reps).toBe(1);
    const [log] = await db.reviewLogs.toArray();
    expect(log).toMatchObject({ itemId: 'w-ni', card: r.card, rating: 3, stateBefore: 0, verdict: 'correct', ms: 3000 });
    // The old course card isn't touched any more.
    expect(await db.reviewItems.get('w-ni')).toBeUndefined();
  });

  it('keeps sentences on their own card', async () => {
    const r = await recordAnswer('s-nihao', 'wrong', { exercise: 'en-to-pinyin' }, t0);
    expect(r).toEqual({ card: 's-nihao', rating: 'again' });
  });

  it('introduces a word without grading it', async () => {
    await recordAnswer('w-ni', 'correct', { exercise: 'intro' }, t0);
    const cards = await db.reviewItems.toArray();
    expect(cards.map((c) => c.id.split('#')[1]).sort()).toEqual(['lm', 'lp', 'mp']);
    expect(cards.every((c) => c.state === 0 && c.reps === 0)).toBe(true);
  });

  it('changes a grade by redoing the review from the card as it was', async () => {
    const id = 'x#mp';
    await db.reviewItems.put(matured(id, 4));
    const before = (await db.reviewItems.get(id))!;
    const t = before.due + 1000;
    await recordReview(id, 'again', { exercise: 'en-to-pinyin', verdict: 'wrong' }, 0.9, t);
    expect((await db.reviewItems.get(id))!.lapses).toBe(before.lapses + 1);
    await regrade(id, 'good', 0.9, t + 5000);
    const after = (await db.reviewItems.get(id))!;
    expect(after.lapses).toBe(before.lapses);
    expect(after.due).toBe(review(before, id, 'good', t).row.due);
    const logs = await db.reviewLogs.toArray();
    expect(logs).toHaveLength(2);
    expect(logs.find((l) => l.replaced)?.rating).toBe(1);
    expect(logs.find((l) => !l.replaced)).toMatchObject({ rating: 3, override: true });
  });

  it('shows facet cards as one card per course word on course screens', () => {
    const w = legacyMap['w-ni'];
    const rows = [matured(`${w}#lm`, 6), matured(`${w}#lp`, 2), { ...matured('w-ni', 1) }, matured('s-nihao', 1)];
    const out = courseCards(rows);
    expect(out.map((r) => r.id).sort()).toEqual(['s-nihao', 'w-ni']);
    expect(out.find((r) => r.id === 'w-ni')!.stability).toBe(rows[1].stability); // the weakest facet
  });
});
