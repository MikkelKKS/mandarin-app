/**
 * "My sentences": sentences you save from the dictionary (a Chinese sentence
 * you looked up, or the Chinese for an English one). They come into your
 * sessions like the built-in sentences: typed in pinyin from your English,
 * and, once the Azure job has recorded them, as dictation too.
 *
 * Kept as one row ("my-sentences") in the synced settings table, so phone and
 * PC share them; the Azure job (scripts/azure-tts.ts) reads that row to record them.
 * Each sentence has one review card, id `m-<hash>`, scheduled with FSRS.
 */
import type { Table } from 'dexie';
import progress from 'virtual:audio-progress';
import { db } from '../db/db';
import { newCard } from './review';
import { useLive } from './useLive';
import type { SentenceRow, VocabData } from './vocabData';

export interface MySentence {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  /** HSK word ids in it (for picking sentences of known words). */
  words: string[];
  addedAt: number;
  /** Removed (kept so a removal syncs to the other device). */
  removed?: boolean;
}

interface Row {
  id: 'my-sentences';
  items: MySentence[];
  updatedAt: number;
}
const ROW = 'my-sentences' as const;
const table = () => db.settings as unknown as Table<Row, string>;

/** A stable id from the characters (the same sentence saved twice is one card). */
export function mySentenceId(hanzi: string): string {
  const s = hanzi.replace(/\s+/g, '');
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return `m-${h.toString(36)}`;
}

export const isMySentenceId = (id: string) => id.startsWith('m-');

export async function loadMySentences(): Promise<MySentence[]> {
  return ((await table().get(ROW))?.items ?? []).filter((s) => !s.removed);
}

export function useMySentences(): MySentence[] | null {
  return useLive(() => loadMySentences(), [], null);
}

/** Save a sentence and make its review card (new: it comes in your next session). */
export async function saveMySentence(s: Omit<MySentence, 'id' | 'addedAt'>, now = Date.now()): Promise<MySentence> {
  const item: MySentence = { ...s, hanzi: s.hanzi.trim(), pinyin: s.pinyin.trim(), english: s.english.trim(), id: mySentenceId(s.hanzi), addedAt: now };
  await db.transaction('rw', db.settings, db.reviewItems, async () => {
    const row = (await table().get(ROW)) ?? { id: ROW, items: [], updatedAt: 0 };
    row.items = [...row.items.filter((x) => x.id !== item.id), item];
    await table().put({ ...row, updatedAt: now });
    const card = await db.reviewItems.get(item.id);
    if (!card) await db.reviewItems.put(newCard(item.id, now));
  });
  return item;
}

export async function removeMySentence(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.settings, db.reviewItems, async () => {
    const row = await table().get(ROW);
    if (!row) return;
    row.items = row.items.map((x) => (x.id === id ? { ...x, removed: true } : x));
    await table().put({ ...row, updatedAt: now });
    await db.reviewItems.delete(id);
  });
}

/** Recorded by the Azure job already (the build lists which ones). */
export const hasRecording = (id: string) => (progress.custom ?? []).includes(id);

export function toSentenceRow(s: MySentence): SentenceRow {
  return { id: s.id, hanzi: s.hanzi, pinyin: s.pinyin, english: [s.english], words: s.words, azure: hasRecording(s.id), course: false };
}

/** The session's sentences plus yours (a copy: the shared word data isn't changed). */
export function withMySentences(data: VocabData, mine: MySentence[]): VocabData {
  if (!mine.length) return data;
  const sentences = new Map(data.sentences);
  for (const s of mine) sentences.set(s.id, toSentenceRow(s));
  return { ...data, sentences };
}
