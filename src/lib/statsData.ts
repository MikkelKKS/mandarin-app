/**
 * Numbers for the Stats screen (CLAUDE.md §2): words by state per HSK level,
 * true retention vs target, the 14-day forecast, and study time, accuracy and
 * XP per day. Pure functions over cards and the review log.
 */
import type { ReviewItemRow, ReviewLogRow } from '../db/db';
import { isPass } from './pinyinAnswer';
import { dayStart, parseCardId, READING_CARD, wordState, type WordState } from './review';

export const STATES: WordState[] = ['new', 'learning', 'young', 'mature'];

export interface LevelRow {
  level: number;
  total: number;
  counts: Record<WordState, number>;
}

/** Each HSK level's words by state (a word is as far as its weakest listening/typing card). */
export function wordsByLevel(words: Array<{ id: string; level: number }>, cards: ReviewItemRow[]): LevelRow[] {
  const byWord = new Map<string, ReviewItemRow[]>();
  for (const c of cards) {
    const p = parseCardId(c.id);
    if (!p || p.facet === 'sp') continue;
    byWord.set(p.word, [...(byWord.get(p.word) ?? []), c]);
  }
  const rows = new Map<number, LevelRow>();
  for (const w of words) {
    if (w.level < 1) continue;
    const r = rows.get(w.level) ?? { level: w.level, total: 0, counts: { new: 0, learning: 0, young: 0, mature: 0 } };
    r.total++;
    r.counts[wordState(byWord.get(w.id) ?? [])]++;
    rows.set(w.level, r);
  }
  return [...rows.values()].sort((a, b) => a.level - b.level);
}

/**
 * True retention: of the reviews of cards that were in long-term review (not new
 * or relearning), the share remembered (graded Hard or better), over the last `days`.
 */
export function retention(logs: ReviewLogRow[], now: number, days: number, reading = false): { n: number; rate: number | null } {
  const since = now - days * 864e5;
  // Reading cards have their own retention (reading = true), so they don't blur the listening numbers.
  const xs = logs.filter((l) => !l.replaced && l.stateBefore === 2 && l.rating && l.at > since && READING_CARD.test(l.card ?? '') === reading);
  const ok = xs.filter((l) => l.rating! > 1).length;
  return { n: xs.length, rate: xs.length ? ok / xs.length : null };
}

/** Reviews due on each of the next `days` days; today includes everything overdue. */
export function forecast(cards: ReviewItemRow[], now: number, mic: boolean, days = 14, reading = false): Array<{ day: number; count: number }> {
  const today = dayStart(now);
  const starts = Array.from({ length: days + 1 }, (_, i) => dayStart(today + i * 864e5 + 6 * 3600e3));
  const out = starts.slice(0, days).map((day) => ({ day, count: 0 }));
  for (const c of cards) {
    if (c.state === 0) continue; // introduced, not reviewed yet
    if (!c.id.includes('#') && !/^(s\d*-|t\d+$|m-)/.test(c.id)) continue; // old course word cards are superseded
    if (!mic && c.id.endsWith('#sp')) continue;
    if (READING_CARD.test(c.id) !== reading) continue;
    const i = c.due < starts[1] ? 0 : starts.findIndex((s, k) => k > 0 && c.due >= s && c.due < starts[k + 1]);
    if (i >= 0 && i < days) out[i].count++;
  }
  return out;
}

export interface DayRow {
  day: number;
  /** Minutes answering (each answer counts at most a minute; older answers without a time count 8 s). */
  minutes: number;
  answers: number;
  accuracy: number | null;
  xp: number;
}

export function perDay(logs: ReviewLogRow[], now: number, days = 30): DayRow[] {
  const today = dayStart(now);
  const rows = Array.from({ length: days }, (_, i) => ({ day: dayStart(today - (days - 1 - i) * 864e5 + 6 * 3600e3), ms: 0, answers: 0, ok: 0, xp: 0 }));
  const index = new Map(rows.map((r, i) => [r.day, i]));
  for (const l of logs) {
    if (l.replaced) continue;
    const i = index.get(dayStart(l.at));
    if (i === undefined) continue;
    const r = rows[i];
    r.ms += Math.min(60_000, l.ms ?? 8_000);
    r.xp += l.xp ?? 0;
    if (!l.exercise.endsWith('intro')) {
      r.answers++;
      if (isPass(l.verdict)) r.ok++;
    }
  }
  return rows.map((r) => ({ day: r.day, minutes: Math.round(r.ms / 60000), answers: r.answers, accuracy: r.answers ? r.ok / r.answers : null, xp: r.xp }));
}

/** Per-tone accuracy from tone answers (Tone Gym, tone exercises, typed pinyin). */
export function toneAccuracy(logs: ReviewLogRow[]): Array<{ tone: number; n: number; rate: number | null }> {
  const n = [0, 0, 0, 0, 0, 0];
  const ok = [0, 0, 0, 0, 0, 0];
  for (const l of logs) {
    if (!l.tones || l.replaced) continue;
    const e = l.tones.expected.split('-').map(Number);
    const g = l.tones.given.split('-').map(Number);
    e.forEach((t, i) => {
      if (!g[i] || t < 1 || t > 5) return;
      n[t]++;
      if (g[i] === t || (t === 3 && e[i + 1] === 3 && g[i] === 2)) ok[t]++;
    });
  }
  return [1, 2, 3, 4, 5].map((t) => ({ tone: t, n: n[t], rate: n[t] ? ok[t] / n[t] : null }));
}

/** Reviews with full FSRS data (needed before the scheduler can be optimised). */
export function optimiserReviews(logs: ReviewLogRow[]): number {
  return logs.filter((l) => !l.replaced && l.rating && l.card).length;
}
export const OPTIMISE_AFTER = 1000;
