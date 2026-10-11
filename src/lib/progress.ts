/** Skill-path progress: mastery per node, unlocking and test-outs. */
import { getUnit, nodeOrder, nodes, units } from '../content';
import { db, type ProgressRow } from '../db/db';

export const MAX_MASTERY = 5;
export const TESTOUT_PASS = 0.8;

export type NodeState = { status: 'locked' | 'open' | 'done'; mastery: number };

/**
 * Pure: work out which nodes are open. A node is open if it's the first one,
 * the node before it is done, or anything later in the path is already done
 * (you jumped ahead with a test-out, so earlier material stays available).
 */
export function computeStates(order: string[], rows: Map<string, ProgressRow>): Map<string, NodeState> {
  const out = new Map<string, NodeState>();
  const done = order.map((id) => (rows.get(id)?.mastery ?? 0) >= 1);
  let lastDone = -1;
  done.forEach((d, i) => d && (lastDone = i));
  order.forEach((id, i) => {
    const mastery = rows.get(id)?.mastery ?? 0;
    const open = i === 0 || done[i - 1] || i < lastDone;
    out.set(id, { status: mastery >= 1 ? 'done' : open ? 'open' : 'locked', mastery });
  });
  return out;
}

export async function progressMap(): Promise<Map<string, ProgressRow>> {
  const rows = await db.progress.toArray();
  return new Map(rows.map((r) => [r.id, r]));
}

/** Pure: new row after finishing a lesson. Every completion counts; mastery only goes up. */
export function afterLesson(prev: ProgressRow | undefined, id: string, accuracy: number, now: number): ProgressRow {
  const mastery = prev?.mastery ?? 0;
  return {
    id,
    kind: 'node',
    mastery: Math.min(MAX_MASTERY, mastery + 1),
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

/** Passing a unit test-out marks all its nodes as done (mastery ≥ 1). */
export async function recordTestOut(unitId: string, accuracy: number): Promise<boolean> {
  const passed = accuracy >= TESTOUT_PASS;
  const now = Date.now();
  await db.transaction('rw', db.progress, async () => {
    const key = `unit:${unitId}`;
    const prev = await db.progress.get(key);
    await db.progress.put({
      id: key,
      kind: 'unit',
      mastery: 0,
      completions: (prev?.completions ?? 0) + 1,
      bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
      testedOut: passed || prev?.testedOut,
      updatedAt: now,
    });
    if (!passed) return;
    for (const n of getUnit(unitId)!.nodes) {
      const p = await db.progress.get(n.id);
      if ((p?.mastery ?? 0) < 1) {
        await db.progress.put({ id: n.id, kind: 'node', mastery: 1, completions: p?.completions ?? 0, bestAccuracy: p?.bestAccuracy ?? 0, testedOut: true, updatedAt: now });
      }
    }
  });
  return passed;
}

/** Words and sentences from open/done nodes (what the learner has seen). */
export function unlockedItemIds(states: Map<string, NodeState>): string[] {
  const ids: string[] = [];
  for (const id of nodeOrder) {
    if (states.get(id)?.status === 'locked') continue;
    const n = nodes.get(id)!;
    ids.push(...n.words, ...n.sentences);
  }
  return [...new Set(ids)];
}

/** Next node to study: first open node that isn't done yet. */
export function nextNode(states: Map<string, NodeState>): string | undefined {
  return nodeOrder.find((id) => states.get(id)?.status === 'open');
}

export function unitComplete(unitId: string, states: Map<string, NodeState>): boolean {
  return getUnit(unitId)!.nodes.every((n) => states.get(n.id)?.status === 'done');
}

export { units };
