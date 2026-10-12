import { describe, expect, it } from 'vitest';
import { computeStats, currentLevel } from './stats';
import type { ReviewItemRow, ReviewLogRow } from '../db/db';

const now = new Date('2026-10-12T12:00:00').getTime();
const card = (id: string, state: number, due: number): ReviewItemRow => ({ id, due, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 1, lapses: 0, state, updatedAt: now });
const log = (itemId: string, verdict: ReviewLogRow['verdict'], extra: Partial<ReviewLogRow> = {}): ReviewLogRow => ({ id: Math.random().toString(), itemId, verdict, exercise: 'tone-id', at: now - 1000, updatedAt: now, ...extra });

describe('stats', () => {
  const words = [
    { id: 'a', hsk: 1, unit: 'u' },
    { id: 'b', hsk: 1, unit: 'u' },
    { id: 'c', hsk: 2, unit: 'u' },
  ];
  it('counts known and settling-in words per HSK level', () => {
    const s = computeStats({ words, units: [], items: [card('a', 2, now + 5 * 864e5), card('b', 1, now - 1)], logs: [], states: new Map(), now });
    expect(s.coverage[0]).toEqual({ level: 1, total: 2, known: 1, learning: 1 });
    expect(s.wordsKnown).toBe(1);
    expect(s.dueNow).toBe(1);
    expect(s.forecast.reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.level).toBe(1);
  });
  it('works out the current level', () => {
    expect(currentLevel([{ level: 1, total: 10, known: 9, learning: 0 }, { level: 2, total: 10, known: 1, learning: 0 }])).toBe(2);
    expect(currentLevel([{ level: 1, total: 10, known: 10, learning: 0 }])).toBe(4);
  });
  it('tracks tone accuracy and mix-ups, allowing third-tone sandhi', () => {
    const logs = [
      log('a', 'correct', { tones: { expected: '3-3', given: '2-3' } }),
      log('b', 'wrong', { tones: { expected: '2', given: '3' } }),
      log('c', 'wrong', { exercise: 'dictation', tones: { expected: '4-1', given: '4-2' } }),
    ];
    const s = computeStats({ words, units: [], items: [], logs, states: new Map(), now });
    expect(s.tones[2]).toMatchObject({ tone: 3, attempts: 2, right: 2 });
    expect(s.tones[1]).toMatchObject({ tone: 2, attempts: 1, right: 0 });
    expect(s.confusions.map((c) => `${c.expected}>${c.given}`).sort()).toEqual(['1>2', '2>3']);
    expect(s.missed.map((m) => m.id).sort()).toEqual(['b', 'c']);
  });
});
