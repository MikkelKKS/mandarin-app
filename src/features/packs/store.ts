/** Imported practice packs: stored in Dexie (and synced), registered at startup. */
import { liveQuery } from 'dexie';
import { db, uuid, type CustomPackRow } from '../../db/db';
import { useLive } from '../../lib/useLive';
import { PackSchema, registerPack, type Pack } from './pack';

export interface StoredPack {
  id: string;
  title: string;
  pack: Pack;
  importedAt: number;
}

function parseRow(r: CustomPackRow): StoredPack | null {
  if ((r as CustomPackRow & { deleted?: boolean }).deleted) return null;
  const p = PackSchema.safeParse(r.pack);
  return p.success ? { id: r.id, title: r.title, pack: p.data, importedAt: r.importedAt } : null;
}

/** Keep the content registry up to date with packs (including ones synced from the other device). */
export function startPackRegistry(): void {
  liveQuery(() => db.customPacks.toArray()).subscribe((rows) => {
    for (const r of rows) {
      const p = parseRow(r);
      if (p) registerPack(p.id, p.pack);
    }
  });
}

export async function savePack(pack: Pack): Promise<string> {
  const id = uuid();
  const now = Date.now();
  registerPack(id, pack);
  await db.customPacks.put({ id, title: pack.title, pack, importedAt: now, updatedAt: now });
  return id;
}

/** Soft delete so the deletion syncs to the other device. */
export async function deletePack(id: string): Promise<void> {
  const r = await db.customPacks.get(id);
  if (r) await db.customPacks.put({ ...r, deleted: true, updatedAt: Date.now() } as CustomPackRow);
}

export function usePacks(): StoredPack[] {
  return useLive(
    async () => (await db.customPacks.orderBy('updatedAt').reverse().toArray()).map(parseRow).filter((p): p is StoredPack => !!p),
    [],
    [],
  );
}

export async function getPack(id: string): Promise<StoredPack | null> {
  const r = await db.customPacks.get(id);
  return r ? parseRow(r) : null;
}

/** All item ids from live packs (for games and look-ups). */
export function packItemIds(packs: StoredPack[]): string[] {
  return packs.flatMap((p) => [...p.pack.words.map((w) => w.id), ...p.pack.sentences.map((s) => s.id)]);
}
