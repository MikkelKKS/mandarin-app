import legacyMap from 'virtual:vocab-legacy';
import { describe, expect, it } from 'vitest';
import { nodes } from '../content';
import type { ProgressRow } from '../db/db';
import type { WordState } from './review';
import { afterLesson, nodeStates } from './progress';

const [firstId, first] = [...nodes].find(([, n]) => n.kind !== 'story' && n.words.length > 1)!;
const hsk = (w: string) => legacyMap[w] ?? w;

describe('Conversations progress', () => {
  it('everything is open; nothing is done at the start', () => {
    const s = nodeStates(new Map(), new Map());
    expect([...s.values()].every((x) => !x.done && x.known === 0)).toBe(true);
  });
  it('a lesson is done once finished', () => {
    const row: ProgressRow = { id: firstId, kind: 'node', mastery: 1, completions: 1, bestAccuracy: 1, updatedAt: 0 };
    expect(nodeStates(new Map([[firstId, row]]), new Map()).get(firstId)!.done).toBe(true);
  });
  it('words learned in sessions count in Conversations', () => {
    const words = new Map<string, WordState>(first.words.map((w) => [hsk(w), 'young']));
    const s = nodeStates(new Map(), words).get(firstId)!;
    expect(s.known).toBe(first.words.length);
    expect(s.done).toBe(true);
    const some = new Map<string, WordState>([[hsk(first.words[0]), 'mature'], [hsk(first.words[1]), 'learning']]);
    const t = nodeStates(new Map(), some).get(firstId)!;
    expect(t.known).toBe(1);
    expect(t.done).toBe(false);
  });
  it('counts completions and keeps the best accuracy', () => {
    let r = afterLesson(undefined, 'a', 0.9, 1);
    r = afterLesson(r, 'a', 0.2, 2);
    expect(r.completions).toBe(2);
    expect(r.bestAccuracy).toBe(0.9);
  });
});
