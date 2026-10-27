/**
 * "Report bad audio": the learner flags a recording; the GitHub job
 * (scripts/azure-tts.ts --reports) re-records it and marks the report fixed.
 * Fixed items get a new cache key, so devices fetch the new file.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db';
import { requestSync } from '../sync';

/** Item id → when its recording was last re-made (for the URL's cache key). */
const fixed = new Map<string, number>();

export function fixedVersion(id: string): number | undefined {
  return fixed.get(id);
}

export function startAudioReports(): void {
  liveQuery(() => db.audioReports.where('status').equals('fixed').toArray()).subscribe({
    next: (rows) => {
      fixed.clear();
      for (const r of rows) if (r.fixedAt) fixed.set(r.id, r.fixedAt);
    },
    error: () => {},
  });
}

export async function reportAudio(id: string, hanzi: string, pinyin?: string): Promise<void> {
  const now = Date.now();
  const prev = await db.audioReports.get(id);
  await db.audioReports.put({
    id,
    hanzi,
    pinyin,
    count: (prev?.count ?? 0) + 1,
    status: 'open',
    reportedAt: now,
    fixedAt: prev?.fixedAt,
    updatedAt: now,
  });
  requestSync(500);
}
