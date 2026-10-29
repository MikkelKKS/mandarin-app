/**
 * The Reading track (CLAUDE.md §3.5): learning to read characters, never to
 * write them. Two FSRS cards per reading item: character → pinyin (`#rp`) and
 * character → meaning (`#rm`). A reading item is a whole HSK word (学生) or a
 * single character (学). A character that is also a word on its own shares one
 * set of cards with that word (the most common one, if several words are
 * written with it).
 *
 * Reading has its own stage per item and never touches the word stage, which
 * stays listening + typing (`wordState` over `#lm #lp #mp`). A word gets
 * reading cards only once its listening → meaning card has graduated to review
 * (or it was marked known), most common words first; its characters come with it.
 */
import { State } from 'ts-fsrs';
import { db, type ReviewItemRow, type ReviewLogRow } from '../db/db';
import { dayStart, newCard, wordState, type WordState } from './review';
import type { VocabRow } from './vocabData';

export type ReadFacet = 'rp' | 'rm';
export const READ_FACETS: ReadFacet[] = ['rp', 'rm'];
export const READ_FACET_LABEL: Record<ReadFacet, string> = { rp: 'Character → pinyin', rm: 'Character → meaning' };
export type ReadMode = ReadFacet | 'mix';

export const readCardId = (item: string, facet: ReadFacet) => `${item}#${facet}`;
export function parseReadId(id: string): { item: string; facet: ReadFacet } | null {
  const m = /^(.+)#(rp|rm)$/.exec(id);
  return m ? { item: m[1], facet: m[2] as ReadFacet } : null;
}
export const isReadingCard = (id: string | undefined) => !!id && /#r[pm]$/.test(id);

/** One character from content/data/hanzi.json (built from Make Me a Hanzi, LGPL). */
export interface HanziChar {
  /** Most common reading. */
  py: string;
  def: string;
  lvl: number;
  alt?: string[];
  /** [part, pinyin, meaning, role: 'meaning' | 'sound' | ''] */
  parts?: Array<[string, string, string, string]>;
  type?: string;
  hint?: string;
  strokes?: number;
}
export type HanziData = Record<string, HanziChar>;

export interface ReadItem {
  id: string;
  hanzi: string;
  /** Most common reading (a word's own pinyin). */
  pinyin: string;
  /** Other readings that also count as right (polyphones). */
  alt: string[];
  meaning: string;
  kind: 'word' | 'char';
  /** The HSK word this item is (words, and characters that are words). */
  word?: string;
  /** Lowest HSK level it appears at. */
  level: number;
  /** Learning order (frequency). */
  order: number;
  /** Item ids of its characters (words of two or more characters). */
  chars: string[];
}

export interface ReadIndex {
  items: Map<string, ReadItem>;
  /** HSK word id → its reading item id (a single-character word → its character's item). */
  itemOfWord: Map<string, string>;
  /** Character → its item id. */
  itemOfChar: Map<string, string>;
  /** Character → words containing it, most common first. */
  wordsWithChar: Map<string, string[]>;
}

const HAN = /^[㐀-鿿]$/;
const isHanziWord = (h: string) => [...h].every((c) => HAN.test(c));

/** Pure: reading items for every HSK word and every character in them. */
export function buildReadIndex(words: VocabRow[], hanzi: HanziData, meaning: (w: VocabRow) => string): ReadIndex {
  const sorted = [...words].sort((a, b) => a.order - b.order);
  const items = new Map<string, ReadItem>();
  const itemOfWord = new Map<string, string>();
  const itemOfChar = new Map<string, string>();
  const wordsWithChar = new Map<string, string[]>();
  const singles = new Map<string, VocabRow[]>();
  for (const w of sorted) {
    if (!isHanziWord(w.hanzi)) continue;
    const cs = [...w.hanzi];
    if (cs.length === 1) singles.set(w.hanzi, [...(singles.get(w.hanzi) ?? []), w]);
    for (const c of new Set(cs)) wordsWithChar.set(c, [...(wordsWithChar.get(c) ?? []), w.id]);
  }
  const level = (w: VocabRow) => (w.level >= 1 ? w.level : 99);
  const wordById = new Map(words.map((w) => [w.id, w]));
  // Characters: one item each; a character that is a word uses that word's id.
  for (const [c, ws] of wordsWithChar) {
    const own = singles.get(c);
    const main = own?.[0];
    const h = hanzi[c];
    const byWord = ws.map((id) => wordById.get(id)).filter((w): w is VocabRow => !!w);
    const minLevel = Math.min(...byWord.map(level));
    const pinyin = main?.pinyin ?? h?.py ?? '';
    if (!pinyin) continue;
    const alt = [...new Set([...(own?.slice(1).map((w) => w.pinyin) ?? []), ...(h?.alt ?? []), ...(main && h?.py && h.py !== main.pinyin ? [h.py] : [])])].filter((p) => p !== pinyin);
    const id = main?.id ?? `c-${c}`;
    items.set(id, {
      id,
      hanzi: c,
      pinyin,
      alt,
      meaning: main ? meaning(main) : (h?.def ?? ''),
      kind: 'char',
      word: main?.id,
      level: minLevel === 99 ? (h?.lvl ?? 0) : minLevel,
      order: main?.order ?? Math.min(...byWord.map((w) => w.order)),
      chars: [],
    });
    itemOfChar.set(c, id);
    for (const w of own ?? []) itemOfWord.set(w.id, id);
  }
  // Words of two or more characters.
  for (const w of sorted) {
    if (!isHanziWord(w.hanzi) || [...w.hanzi].length < 2) continue;
    items.set(w.id, {
      id: w.id,
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      alt: [],
      meaning: meaning(w),
      kind: 'word',
      word: w.id,
      level: w.level,
      order: w.order,
      chars: [...new Set([...w.hanzi])].map((c) => itemOfChar.get(c)).filter((x): x is string => !!x),
    });
    itemOfWord.set(w.id, w.id);
  }
  return { items, itemOfWord, itemOfChar, wordsWithChar };
}

/** Out of the learning steps: a listening → meaning card in review (or relearning after a lapse). */
export const graduated = (c: ReviewItemRow | undefined) => !!c && (c.state === State.Review || c.state === State.Relearning);

/** Pure: reading stage per item, from its two reading cards (the same rule as the word stage). */
export function readingStates(cards: ReviewItemRow[]): Map<string, WordState> {
  const by = new Map<string, ReviewItemRow[]>();
  for (const c of cards) {
    const p = parseReadId(c.id);
    if (p) by.set(p.item, [...(by.get(p.item) ?? []), c]);
  }
  const out = new Map<string, WordState>();
  for (const [item, cs] of by) out.set(item, wordState(cs.length >= 2 ? cs : [...cs, undefined]));
  return out;
}

export interface ReadQueueOptions {
  now: number;
  mode: ReadMode;
  /** New reading words a day (their characters come on top). */
  newPerDay: number;
  /** New reading words already started today. */
  newToday: number;
  /** At most this many new words (a deep session's few). */
  maxNew?: number;
}

export interface NewReadItem {
  item: string;
  /** The word a character came with (doesn't count towards the daily limit). */
  via?: string;
}

export interface ReadQueue {
  /** Due reading card ids in the chosen direction(s), most overdue first. */
  due: string[];
  /** Cards of items already met but not yet asked in this direction. */
  pending: string[];
  /** Items to meet now: words in frequency order, each followed by its new characters. */
  fresh: NewReadItem[];
  /** New reading words left today (without their characters). */
  newLeft: number;
}

const facetsOf = (mode: ReadMode): ReadFacet[] => (mode === 'mix' ? READ_FACETS : [mode]);

/** Pure: what to read now. `words` in learning order. */
export function buildReadQueue(index: ReadIndex, words: VocabRow[], cards: ReviewItemRow[], o: ReadQueueOptions): ReadQueue {
  const facets = facetsOf(o.mode);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const readCards = cards.filter((c) => {
    const p = parseReadId(c.id);
    return p && facets.includes(p.facet);
  });
  const due = readCards
    .filter((c) => c.state !== State.New && c.due <= o.now)
    .map((c) => ({ id: c.id, late: (o.now - c.due) / 864e5 / Math.max(1, c.scheduledDays) }))
    .sort((a, b) => b.late - a.late)
    .map((x) => x.id);
  const started = new Set<string>();
  for (const c of cards) {
    const p = parseReadId(c.id);
    if (p) started.add(p.item);
  }
  const pending = readCards.filter((c) => c.state === State.New).map((c) => c.id);
  const fresh: NewReadItem[] = [];
  const queued = new Set<string>();
  const addChars = (item: ReadItem) => {
    for (const ch of item.chars) {
      if (started.has(ch) || queued.has(ch)) continue;
      queued.add(ch);
      fresh.push({ item: ch, via: item.id });
    }
  };
  // Characters still owed by words you started reading earlier.
  for (const id of started) {
    const it = index.items.get(id);
    if (it?.kind === 'word') addChars(it);
  }
  let room = Math.max(0, Math.min(o.newPerDay - o.newToday, o.maxNew ?? Infinity));
  const newLeft = Math.max(0, o.newPerDay - o.newToday);
  for (const w of words) {
    if (room <= 0) break;
    const id = index.itemOfWord.get(w.id);
    if (!id || started.has(id) || queued.has(id)) continue;
    // Ready: you know it by ear (its listening → meaning card has graduated).
    if (!graduated(byId.get(`${w.id}#lm`))) continue;
    const it = index.items.get(id);
    if (!it) continue;
    queued.add(id);
    fresh.push({ item: id });
    room--;
    if (it.kind === 'word') addChars(it);
  }
  return { due, pending, fresh, newLeft };
}

/** Pure: new reading words started since the day began (characters that came with a word don't count). */
export function newReadToday(logs: Array<Pick<ReviewLogRow, 'exercise' | 'itemId' | 'at' | 'via' | 'replaced'>>, now: number): number {
  const start = dayStart(now);
  const seen = new Set<string>();
  for (const l of logs) if (l.exercise === 'read-intro' && l.at >= start && !l.via && !l.replaced) seen.add(l.itemId);
  return seen.size;
}

/** Look-alike groups (content/lookalikes.json): the characters to show next to `c`. */
export function lookalikesOf(c: string, groups: string[]): string[] {
  const out = new Set<string>();
  for (const g of groups) if (g.includes(c)) for (const x of g) if (x !== c) out.add(x);
  return [...out];
}

/** Pure: words and characters by reading stage per HSK level (Stats). */
export function readingByLevel(index: ReadIndex, words: VocabRow[], states: Map<string, WordState>) {
  const empty = () => ({ new: 0, learning: 0, young: 0, mature: 0 }) as Record<WordState, number>;
  const wordRows = new Map<number, { level: number; total: number; counts: Record<WordState, number> }>();
  const charRows = new Map<number, { level: number; total: number; counts: Record<WordState, number> }>();
  const add = (rows: typeof wordRows, level: number, s: WordState) => {
    const r = rows.get(level) ?? { level, total: 0, counts: empty() };
    r.total++;
    r.counts[s]++;
    rows.set(level, r);
  };
  for (const w of words) {
    if (w.level < 1) continue;
    const id = index.itemOfWord.get(w.id);
    if (id) add(wordRows, w.level, states.get(id) ?? 'new');
  }
  for (const it of index.items.values()) if (it.kind === 'char' && it.level >= 1) add(charRows, it.level, states.get(it.id) ?? 'new');
  const sort = (m: typeof wordRows) => [...m.values()].sort((a, b) => a.level - b.level);
  return { words: sort(wordRows), chars: sort(charRows) };
}

/** Pure: share of the characters in a text you can read (their reading stage is young or mature). */
export function readableShare(text: string, index: ReadIndex, states: Map<string, WordState>): number | null {
  const cs = [...text].filter((c) => HAN.test(c));
  if (!cs.length) return null;
  const ok = cs.filter((c) => {
    const s = states.get(index.itemOfChar.get(c) ?? '');
    return s === 'young' || s === 'mature';
  }).length;
  return ok / cs.length;
}

/** Make both reading cards for an item the first time it's met (no grade yet). */
export async function introduceReadItem(item: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.reviewItems, async () => {
    for (const f of READ_FACETS) {
      const id = readCardId(item, f);
      if (!(await db.reviewItems.get(id))) await db.reviewItems.put(newCard(id, now));
    }
  });
}

// ---------------------------------------------------------------------------
// Loading (lazy chunks)

let hanziCache: Promise<{ chars: HanziData; groups: string[] }> | null = null;
export function loadHanzi(): Promise<{ chars: HanziData; groups: string[] }> {
  hanziCache ??= Promise.all([import('../../content/data/hanzi.json'), import('../../content/lookalikes.json')]).then(([h, l]) => ({
    chars: (h.default ?? h).chars as unknown as HanziData,
    groups: (l.default ?? l).groups as string[],
  }));
  return hanziCache;
}
