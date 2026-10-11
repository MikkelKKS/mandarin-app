/** Words added from the dictionary into practice ("My words"). Synced like a pack. */
import { liveQuery } from 'dexie';
import { createEmptyCard } from 'ts-fsrs';
import { words } from '../../content';
import type { Word } from '../../content/schema';
import { db, type CustomPackRow } from '../../db/db';
import { toNumeric } from '../../lib/pinyin';
import { rowFromCard } from '../../lib/srs';
import { useLive } from '../../lib/useLive';
import type { Entry } from './dict';

const ROW_ID = 'my-words';
interface MyWordsPack {
  format: 'my-words/1';
  words: Word[];
}

export function myWordId(e: Pick<Entry, 'hanzi' | 'key'>): string {
  return `p-my-${[...e.hanzi].map((c) => c.codePointAt(0)!.toString(16)).join('')}-${e.key}`;
}

function packOf(r?: CustomPackRow): MyWordsPack {
  const p = r?.pack as MyWordsPack | undefined;
  return p?.format === 'my-words/1' ? p : { format: 'my-words/1', words: [] };
}

export function startMyWordsRegistry(): void {
  liveQuery(() => db.customPacks.get(ROW_ID)).subscribe((r) => {
    for (const w of packOf(r).words) words.set(w.id, { ...w, unit: 'my-words' });
  });
}

export async function addMyWord(e: Entry): Promise<void> {
  const id = myWordId(e);
  const now = Date.now();
  const w: Word = {
    id,
    hanzi: e.hanzi,
    pinyin: e.pinyin,
    pinyinNumeric: toNumeric(e.pinyin),
    english: e.defs.slice(0, 3).map((d) => (d.length > 60 ? d.slice(0, 57) + '…' : d)),
    hsk: e.hsk,
    pos: 'phrase',
    unit: 'my-words',
  };
  await db.transaction('rw', db.customPacks, db.reviewItems, async () => {
    const row = await db.customPacks.get(ROW_ID);
    const pack = packOf(row);
    if (pack.words.some((x) => x.id === id)) return;
    pack.words.push(w);
    await db.customPacks.put({ id: ROW_ID, title: 'My words', pack, importedAt: row?.importedAt ?? now, updatedAt: now });
    if (!(await db.reviewItems.get(id))) await db.reviewItems.put(rowFromCard(id, createEmptyCard(new Date(now)), now));
  });
  words.set(id, w);
}

export async function removeMyWord(id: string): Promise<void> {
  const row = await db.customPacks.get(ROW_ID);
  if (!row) return;
  const pack = packOf(row);
  pack.words = pack.words.filter((w) => w.id !== id);
  await db.customPacks.put({ ...row, pack, updatedAt: Date.now() });
  await db.reviewItems.delete(id);
}

export function useMyWords(): Word[] {
  return useLive(async () => packOf(await db.customPacks.get(ROW_ID)).words, [], []);
}
