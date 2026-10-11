/**
 * Conflict rules for syncing (CLAUDE.md §8):
 * - last write wins per row, by `updatedAt`
 * - review logs are append-only (merged by id; never overwritten)
 * - node mastery takes the max (progress never goes backwards)
 */
import type { ProgressRow } from '../db/db';

export const SYNC_TABLES = ['progress', 'reviewItems', 'reviewLogs', 'settings', 'customPacks', 'gameScores'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Supabase table name for each local table. */
export const REMOTE_NAME: Record<SyncTable, string> = {
  progress: 'progress',
  reviewItems: 'review_items',
  reviewLogs: 'review_logs',
  settings: 'settings',
  customPacks: 'custom_packs',
  gameScores: 'game_scores',
};

export interface Row {
  id: string;
  updatedAt: number;
  [k: string]: unknown;
}

/**
 * Merge an incoming row into the local one. Returns the row to store locally
 * and whether it differs from `incoming` (i.e. the merged result must be sent back).
 */
export function mergeRow(table: SyncTable, local: Row | undefined, incoming: Row): { row: Row; pushBack: boolean } {
  if (!local) return { row: incoming, pushBack: false };
  if (table === 'reviewLogs') return { row: local, pushBack: false };
  if (table === 'progress') {
    const a = local as unknown as ProgressRow;
    const b = incoming as unknown as ProgressRow;
    const row: ProgressRow = {
      ...(a.updatedAt >= b.updatedAt ? a : b),
      mastery: Math.max(a.mastery, b.mastery),
      completions: Math.max(a.completions, b.completions),
      bestAccuracy: Math.max(a.bestAccuracy, b.bestAccuracy),
      testedOut: !!(a.testedOut || b.testedOut) || undefined,
      updatedAt: Math.max(a.updatedAt, b.updatedAt),
    };
    const same =
      row.mastery === b.mastery && row.completions === b.completions && row.bestAccuracy === b.bestAccuracy && !!row.testedOut === !!b.testedOut;
    return { row: row as unknown as Row, pushBack: !same };
  }
  if (table === 'gameScores') {
    const best = Math.max(Number(local.best ?? 0), Number(incoming.best ?? 0));
    const plays = Math.max(Number(local.plays ?? 0), Number(incoming.plays ?? 0));
    const newer = local.updatedAt >= incoming.updatedAt ? local : incoming;
    const row = { ...newer, best, plays, updatedAt: Math.max(local.updatedAt, incoming.updatedAt) };
    return { row, pushBack: best !== incoming.best || plays !== incoming.plays };
  }
  // Last write wins.
  if (incoming.updatedAt >= local.updatedAt) return { row: incoming, pushBack: false };
  return { row: local, pushBack: true };
}
