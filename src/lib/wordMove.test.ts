import { describe, expect, it } from 'vitest';
import type { ReviewItemRow } from '../db/db';
import { cardState, newCard, wordState, type WordState } from './review';
import { movedCards } from './wordMove';

const now = Date.UTC(2026, 9, 28);
const stateAfter = (to: WordState, existing: ReviewItemRow[] = []) => {
  const map = new Map(existing.map((c) => [c.id, c]));
  const rows = movedCards(['w-a'], to, map, now, () => 0.5);
  for (const r of rows) map.set(r.id, r);
  return { rows, state: wordState([...map.values()].filter((c) => c.word === 'w-a' && c.facet !== 'sp')) };
};
const mature = (f: string): ReviewItemRow => ({ ...newCard(`w-a#${f}`, now), state: 2, reps: 3, scheduledDays: 40, due: now + 40 * 864e5 });

describe('moving words by hand', () => {
  it('moves a word into each state', () => {
    for (const to of ['learning', 'young', 'mature'] as WordState[]) expect(stateAfter(to).state).toBe(to);
  });
  it('takes a mature word back to not started, speaking card included', () => {
    const { rows, state } = stateAfter('new', [mature('lm'), mature('lp'), mature('mp'), mature('sp')]);
    expect(state).toBe('new');
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => cardState(r) === 'new')).toBe(true);
  });
  it('a mature word moved to learning or young comes back sooner', () => {
    const before = [mature('lm'), mature('lp'), mature('mp')];
    const learning = stateAfter('learning', before);
    expect(learning.state).toBe('learning');
    expect(learning.rows.every((r) => r.due < now + 864e5)).toBe(true);
    const young = stateAfter('young', before);
    expect(young.state).toBe('young');
    expect(young.rows.every((r) => r.due > now && r.due <= now + 14 * 864e5)).toBe(true);
  });
  it('leaves an unstarted word alone when moved to not started', () => {
    expect(stateAfter('new').rows).toEqual([]);
  });
});
