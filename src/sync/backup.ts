/** Manual full backup: export everything to a JSON file and merge it back in. */
import type { Table } from 'dexie';
import { z } from 'zod';
import { db } from '../db/db';
import { mergeRow, SYNC_TABLES, type Row } from './merge';

const BackupSchema = z.object({
  app: z.literal('mandarin-app'),
  version: z.literal(1),
  exportedAt: z.number(),
  tables: z.record(z.array(z.object({ id: z.string(), updatedAt: z.number() }).passthrough())),
});

export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = await db[t].toArray();
  const data = { app: 'mandarin-app', version: 1, exportedAt: Date.now(), tables };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Merge a backup into this device (never loses newer local progress). Returns rows changed. */
export async function importBackup(text: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON — pick a file exported from this app.");
  }
  const r = BackupSchema.safeParse(parsed);
  if (!r.success) throw new Error("That file isn't a backup from this app.");
  let changed = 0;
  for (const t of SYNC_TABLES) {
    const table = db[t] as unknown as Table<Row, string>;
    const rows = (r.data.tables[t] ?? []) as Row[];
    await db.transaction('rw', table, async () => {
      for (const incoming of rows) {
        const local = await table.get(incoming.id);
        const { row } = mergeRow(t, local, incoming);
        if (row !== local) {
          // Touch so the restored rows sync up to other devices.
          await table.put({ ...row, updatedAt: Math.max(row.updatedAt, Date.now()) });
          changed++;
        }
      }
    });
  }
  return changed;
}
