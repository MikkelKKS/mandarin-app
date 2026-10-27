/**
 * Offline-first sync: Dexie is the source of truth on each device.
 * One sync = for each table, pull rows changed on the server since the last
 * pull, merge them in (see merge.ts), then push rows changed locally since
 * the last push.
 */
import type { Table } from 'dexie';
import type { MandarinDB } from '../db/db';
import { mergeRow, OPTIONAL_TABLES, REMOTE_NAME, SYNC_TABLES, type Row, type SyncTable } from './merge';

export interface RemoteRow {
  id: string;
  data: Row;
  updated_at: number;
  server_updated_at: string;
}

export interface Remote {
  /** All rows changed after `since` (ISO timestamp), oldest first. */
  pull(table: string, since: string | null): Promise<RemoteRow[]>;
  push(table: string, rows: Array<{ id: string; data: Row; updated_at: number }>): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

const PULL_OVERLAP_MS = 5000; // re-read a few seconds back in case of late commits
const PUSH_KEY = 'sync:lastPush';
const pullKey = (t: SyncTable) => `sync:pull:${t}`;

async function getMeta<T>(db: MandarinDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function resetSyncCursors(db: MandarinDB): Promise<void> {
  const keys = (await db.meta.toCollection().primaryKeys()).filter((k) => String(k).startsWith('sync:'));
  await db.meta.bulkDelete(keys);
}

const unsyncedKey = (t: string) => `sync:unsynced:${t}`;

/** Supabase/PostgREST error for a table that doesn't exist. */
export function isMissingTable(e: unknown): boolean {
  const x = e as { code?: string; message?: string } | null;
  return !!x && (x.code === 'PGRST205' || x.code === '42P01' || /does not exist|could not find the table/i.test(x.message ?? ''));
}

export async function syncOnce(db: MandarinDB, remote: Remote): Promise<SyncResult> {
  const pushStart = Date.now();
  const lastPush = (await getMeta<number>(db, PUSH_KEY)) ?? 0;
  let pulled = 0;
  let pushed = 0;

  for (const t of SYNC_TABLES) {
    const table = db[t] as unknown as Table<Row, string>;
    const since = await getMeta<string>(db, pullKey(t));
    const sinceWithOverlap = since ? new Date(new Date(since).getTime() - PULL_OVERLAP_MS).toISOString() : null;

    // 1. Pull + merge
    let incoming: RemoteRow[];
    try {
      incoming = await remote.pull(REMOTE_NAME[t], sinceWithOverlap);
    } catch (e) {
      // A newer table that hasn't been created in Supabase yet: skip it, and push everything once it exists.
      if (OPTIONAL_TABLES.has(t) && isMissingTable(e)) {
        await db.meta.put({ key: unsyncedKey(t), value: true });
        continue;
      }
      throw e;
    }
    const pushAll = !!(await getMeta<boolean>(db, unsyncedKey(t)));
    const settled = new Set<string>(); // rows now identical to the server copy
    let cursor = since ?? null;
    if (incoming.length) {
      await db.transaction('rw', table, async () => {
        for (const r of incoming) {
          const remoteRow: Row = { ...r.data, id: r.id, updatedAt: r.updated_at };
          const local = await table.get(r.id);
          const { row, pushBack } = mergeRow(t, local, remoteRow);
          if (pushBack) {
            // Make sure the merged result is sent back up.
            await table.put({ ...row, updatedAt: Math.max(row.updatedAt, lastPush + 1) });
          } else {
            if (row !== local) await table.put(row);
            settled.add(r.id);
          }
          pulled++;
        }
      });
      for (const r of incoming) if (!cursor || r.server_updated_at > cursor) cursor = r.server_updated_at;
    }

    // 2. Push local changes
    const changed = (await table.where('updatedAt').above(pushAll ? -1 : lastPush).toArray()).filter((r) => !settled.has(r.id));
    for (let i = 0; i < changed.length; i += 500) {
      const chunk = changed.slice(i, i + 500);
      await remote.push(
        REMOTE_NAME[t],
        chunk.map((r) => ({ id: r.id, data: r, updated_at: r.updatedAt })),
      );
    }
    pushed += changed.length;
    if (cursor) await db.meta.put({ key: pullKey(t), value: cursor });
    if (pushAll) await db.meta.delete(unsyncedKey(t));
  }

  await db.meta.put({ key: PUSH_KEY, value: pushStart });
  return { pulled, pushed };
}
