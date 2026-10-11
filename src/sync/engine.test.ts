import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MandarinDB, type ProgressRow } from '../db/db';
import { syncOnce, type Remote, type RemoteRow } from './engine';
import { mergeRow } from './merge';

/** In-memory stand-in for Supabase (one user). */
class MemoryRemote implements Remote {
  tables = new Map<string, Map<string, RemoteRow>>();
  private tick = 0;
  private stamp() {
    // strictly increasing ISO timestamps
    this.tick++;
    return new Date(Date.UTC(2030, 0, 1) + this.tick * 10).toISOString();
  }
  async pull(table: string, since: string | null) {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((r) => !since || r.server_updated_at > since).sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at));
  }
  async push(table: string, rows: Array<{ id: string; data: never; updated_at: number }>) {
    const t = this.tables.get(table) ?? new Map();
    this.tables.set(table, t);
    for (const r of rows) t.set(r.id, { ...r, data: JSON.parse(JSON.stringify(r.data)), server_updated_at: this.stamp() });
  }
}

let n = 0;
const device = () => new MandarinDB(`test-${++n}`);
const progress = (id: string, mastery: number, updatedAt: number, completions = mastery): ProgressRow => ({
  id,
  kind: 'node',
  mastery,
  completions,
  bestAccuracy: 0.5,
  updatedAt,
});

describe('merge rules', () => {
  it('takes the max mastery regardless of timestamps', () => {
    const r = mergeRow('progress', progress('a', 3, 100) as never, progress('a', 1, 200) as never);
    expect((r.row as unknown as ProgressRow).mastery).toBe(3);
    expect(r.pushBack).toBe(true);
  });
  it('last write wins for settings', () => {
    const older = { id: 'me', updatedAt: 1, sound: true };
    const newer = { id: 'me', updatedAt: 2, sound: false };
    expect(mergeRow('settings', older, newer).row).toBe(newer);
    expect(mergeRow('settings', newer, older)).toEqual({ row: newer, pushBack: true });
  });
  it('never overwrites a review log', () => {
    const a = { id: 'l1', updatedAt: 1, verdict: 'wrong' };
    expect(mergeRow('reviewLogs', a, { id: 'l1', updatedAt: 9, verdict: 'correct' }).row).toBe(a);
  });
});

describe('sync between two devices', () => {
  let remote: MemoryRemote;
  let phone: MandarinDB;
  let pc: MandarinDB;
  beforeEach(() => {
    remote = new MemoryRemote();
    phone = device();
    pc = device();
  });

  it('copies progress, reviews and logs from one device to the other', async () => {
    await phone.progress.put(progress('n00-hello', 2, Date.now()));
    await phone.reviewLogs.add({ id: 'log1', itemId: 'w-ni', exercise: 'dictation', verdict: 'correct', at: 1, updatedAt: Date.now() });
    await syncOnce(phone, remote);
    await syncOnce(pc, remote);
    expect((await pc.progress.get('n00-hello'))?.mastery).toBe(2);
    expect(await pc.reviewLogs.count()).toBe(1);
  });

  it('merges offline work on both devices without losing anything', async () => {
    await phone.progress.put(progress('n00-hello', 3, 1000));
    await pc.progress.put(progress('n00-hello', 1, 2000));
    await phone.reviewLogs.add({ id: 'p1', itemId: 'w-ni', exercise: 'x', verdict: 'wrong', at: 1, updatedAt: Date.now() });
    await pc.reviewLogs.add({ id: 'c1', itemId: 'w-hao', exercise: 'x', verdict: 'correct', at: 2, updatedAt: Date.now() });

    await syncOnce(phone, remote);
    await syncOnce(pc, remote); // pc pulls mastery 3, keeps max, pushes logs
    await syncOnce(phone, remote);

    for (const db of [phone, pc]) {
      expect((await db.progress.get('n00-hello'))?.mastery).toBe(3);
      expect((await db.reviewLogs.toArray()).map((l) => l.id).sort()).toEqual(['c1', 'p1']);
    }
  });

  it('uses the newest settings', async () => {
    await phone.settings.put({ ...DEFAULT_SETTINGS, id: 'me', sound: false, updatedAt: Date.now() - 5000 });
    await syncOnce(phone, remote);
    await pc.settings.put({ ...DEFAULT_SETTINGS, id: 'me', sound: true, strictTones: true, updatedAt: Date.now() });
    await syncOnce(pc, remote);
    await syncOnce(phone, remote);
    expect((await phone.settings.get('me'))?.strictTones).toBe(true);
    expect((await phone.settings.get('me'))?.sound).toBe(true);
  });

  it('settles: a second sync with no changes pushes nothing', async () => {
    await phone.progress.put(progress('a', 1, Date.now()));
    await syncOnce(phone, remote);
    await syncOnce(pc, remote);
    const again = await syncOnce(pc, remote);
    expect(again.pushed).toBe(0);
  });
});
