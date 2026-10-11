import { describe, expect, it } from 'vitest';
import type { ProgressRow } from '../db/db';
import { afterLesson, computeStates } from './progress';

const row = (id: string, mastery: number): [string, ProgressRow] => [id, { id, kind: 'node', mastery, completions: 1, bestAccuracy: 1, updatedAt: 0 }];
const order = ['a', 'b', 'c', 'd'];

describe('progress', () => {
  it('opens only the first node at the start', () => {
    const s = computeStates(order, new Map());
    expect(order.map((id) => s.get(id)!.status)).toEqual(['open', 'locked', 'locked', 'locked']);
  });
  it('opens the next node when one is done', () => {
    const s = computeStates(order, new Map([row('a', 1)]));
    expect(order.map((id) => s.get(id)!.status)).toEqual(['done', 'open', 'locked', 'locked']);
  });
  it('keeps skipped nodes open after jumping ahead', () => {
    const s = computeStates(order, new Map([row('c', 1)]));
    expect(order.map((id) => s.get(id)!.status)).toEqual(['open', 'open', 'done', 'open']);
  });
  it('raises mastery on every completion, caps at 5 and keeps the best accuracy', () => {
    let r = afterLesson(undefined, 'a', 0.9, 1);
    expect(r.mastery).toBe(1);
    r = afterLesson(r, 'a', 0.2, 2);
    expect(r.mastery).toBe(2);
    expect(r.bestAccuracy).toBe(0.9);
    expect(r.completions).toBe(2);
    for (let i = 0; i < 10; i++) r = afterLesson(r, 'a', 1, 3);
    expect(r.mastery).toBe(5);
  });
});
