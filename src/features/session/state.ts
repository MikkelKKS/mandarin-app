/**
 * The session in progress, saved after every answer so it can be resumed on
 * either device. Kept as one row ("session") in the synced settings table
 * (last write wins), next to the settings row ("me").
 */
import type { Table } from 'dexie';
import { db } from '../../db/db';
import type { SessionPlan } from './plan';

export interface SessionState {
  /** 'session': quick and deep sessions; 'reading': a Reading tab round (kept apart so neither replaces the other). */
  id: 'session' | 'reading';
  plan: SessionPlan;
  block: number;
  item: number;
  xp: number;
  combo: number;
  bestCombo: number;
  right: number;
  answered: number;
  newWords: string[];
  /** Tones of this session's answers, for "weakest tone pair today". */
  tones: Array<{ expected: string; given: string }>;
  done: boolean;
  startedAt: number;
  updatedAt: number;
}

const table = () => db.settings as unknown as Table<SessionState, string>;

/** Sessions older than this aren't offered for resuming. */
export const RESUME_HOURS = 18;

export async function loadSession(key: SessionState['id'] = 'session', now = Date.now()): Promise<SessionState | null> {
  const s = await table().get(key);
  if (!s || s.done || now - s.updatedAt > RESUME_HOURS * 3600e3) return null;
  return s;
}

export async function saveSession(s: SessionState): Promise<void> {
  await table().put({ ...s, updatedAt: Date.now() });
}

export function remainingItems(s: SessionState): number {
  let n = 0;
  s.plan.blocks.forEach((b, i) => {
    if (i > s.block) n += b.items.length;
    else if (i === s.block) n += Math.max(0, b.items.length - s.item);
  });
  return n;
}
