/**
 * Conversations progress. Nothing is locked: every unit and lesson is open.
 * A lesson counts as done once you've finished it, or once you know all its
 * words from anywhere in the app (sessions, placement, moving words by hand),
 * so the two ways of learning share one picture of what you know.
 */
import { nodes, units } from '../content';
import { db, type ProgressRow } from '../db/db';
import { courseWordState, isKnownState } from './knowledge';
import type { WordState } from './review';

export interface NodeState {
  done: boolean;
  /** Times finished. */
  completions: number;
  /** Words of the lesson you know (in review), and how many it has. */
  known: number;
  total: number;
}

/** Pure: the state of every lesson from its progress row and your word knowledge. */
export function nodeStates(rows: Map<string, ProgressRow>, words: Map<string, WordState>): Map<string, NodeState> {
  const out = new Map<string, NodeState>();
  for (const [id, n] of nodes) {
    const row = rows.get(id);
    const known = n.words.filter((w) => isKnownState(courseWordState(w, words))).length;
    const total = n.words.length;
    const completions = row?.completions ?? 0;
    out.set(id, {
      done: completions > 0 || (row?.mastery ?? 0) >= 1 || (total > 0 && known === total),
      completions,
      known,
      total,
    });
  }
  return out;
}

/** Pure: how far along a unit is (its distinct words you know, and lessons done). */
export function unitProgress(unitId: string, states: Map<string, NodeState>, words: Map<string, WordState>) {
  const u = units.find((x) => x.id === unitId)!;
  const ids = [...new Set(u.nodes.flatMap((n) => nodes.get(n.id)?.words ?? []))];
  const known = ids.filter((w) => isKnownState(courseWordState(w, words))).length;
  const done = u.nodes.filter((n) => states.get(n.id)?.done).length;
  return { known, total: ids.length, done, lessons: u.nodes.length };
}

/** Pure: new row after finishing a lesson. */
export function afterLesson(prev: ProgressRow | undefined, id: string, accuracy: number, now: number): ProgressRow {
  return {
    id,
    kind: 'node',
    mastery: Math.min(5, (prev?.mastery ?? 0) + 1),
    completions: (prev?.completions ?? 0) + 1,
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
    testedOut: prev?.testedOut,
    updatedAt: now,
  };
}

export async function recordLesson(nodeId: string, accuracy: number): Promise<ProgressRow> {
  const now = Date.now();
  const row = afterLesson(await db.progress.get(nodeId), nodeId, accuracy, now);
  await db.progress.put(row);
  return row;
}
