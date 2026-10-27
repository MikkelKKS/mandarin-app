/**
 * Session plans (CLAUDE.md §7).
 * - Quick (phone, about 5 minutes): due reviews with Tone Gym items mixed in;
 *   a few new words when little is due.
 * - Deep (PC, 20+ minutes): reviews → new words → listening and dictation →
 *   (speaking, step 9) → a Tone Gym round.
 * Pure: everything it needs is passed in.
 */
import { parseCardId, type Facet } from '../../lib/review';
import type { SentenceRow, VocabData, VocabRow } from '../../lib/vocabData';
import type { GymItem } from '../tonegym/model';

export type SessionMode = 'quick' | 'deep';

/** One step of a session. `retry`: a wrong answer asked again at the end of its block. */
export type SItem = SItemBase & { retry?: boolean };
type SItemBase =
  | { kind: 'intro'; word: string }
  | { kind: 'choose-meaning'; word: string; options: string[] }
  | { kind: 'listen-meaning'; word: string }
  | { kind: 'dictation'; word: string }
  | { kind: 'meaning-pinyin'; word: string }
  | { kind: 'sentence-dictation'; sentence: string; card?: string }
  | { kind: 'sentence-meaning'; sentence: string }
  | { kind: 'tone'; gym: GymItem };

export type BlockId = 'reviews' | 'new' | 'listening' | 'tones';
export const BLOCK_TITLE: Record<BlockId, string> = {
  reviews: 'Reviews',
  new: 'New words',
  listening: 'Listening',
  tones: 'Tone Gym',
};

export interface Block {
  id: BlockId;
  items: SItem[];
}

export interface SessionPlan {
  id: string;
  mode: SessionMode;
  blocks: Block[];
  createdAt: number;
}

/** The facet card an item updates, if any. */
export function cardOf(it: SItem): string | null {
  switch (it.kind) {
    case 'choose-meaning':
    case 'listen-meaning':
      return `${it.word}#lm`;
    case 'dictation':
      return `${it.word}#lp`;
    case 'meaning-pinyin':
      return `${it.word}#mp`;
    case 'sentence-dictation':
      return it.card ?? null;
    default:
      return null;
  }
}

/** A word or sentence the app has a recording for. */
const wordHasAudio = (w: VocabRow | undefined) => !!w && (w.azure || !!w.course);
const sentenceHasAudio = (s: SentenceRow | undefined) => !!s && (s.azure || s.course);

export function reviewItem(card: string, data: VocabData): SItem | null {
  const p = parseCardId(card);
  if (!p) {
    const s = data.sentences.get(card);
    return s && sentenceHasAudio(s) ? { kind: 'sentence-dictation', sentence: card, card } : null;
  }
  const w = data.byId.get(p.word);
  if (!w) return null;
  const byFacet: Record<Facet, SItem | null> = {
    lm: wordHasAudio(w) ? { kind: 'listen-meaning', word: w.id } : null,
    lp: wordHasAudio(w) ? { kind: 'dictation', word: w.id } : null,
    mp: { kind: 'meaning-pinyin', word: w.id },
    sp: null, // speaking comes with step 9
  };
  return byFacet[p.facet];
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Three other words with different meanings, close in level, for the first-exposure choice. */
export function distractors(word: VocabRow, data: VocabData, rng: () => number): string[] {
  const near = data.words.filter((w) => w.id !== word.id && Math.abs(w.order - word.order) < 400 && w.gloss[0] && w.gloss[0] !== word.gloss[0]);
  return shuffle(near, rng).slice(0, 3).map((w) => w.id);
}

/** New words: meet each one (intro + first choice), then type each twice (by ear, from English), then hear it in a sentence. */
export function newWordItems(words: string[], data: VocabData, rng: () => number): SItem[] {
  const ws = words.map((id) => data.byId.get(id)).filter((w): w is VocabRow => !!w);
  const out: SItem[] = [];
  for (const w of ws) {
    out.push({ kind: 'intro', word: w.id });
    if (wordHasAudio(w)) out.push({ kind: 'choose-meaning', word: w.id, options: shuffle([w.id, ...distractors(w, data, rng)], rng) });
  }
  const typed: SItem[] = [];
  for (const w of ws) {
    if (wordHasAudio(w)) typed.push({ kind: 'dictation', word: w.id });
    typed.push({ kind: 'meaning-pinyin', word: w.id });
  }
  out.push(...shuffle(typed, rng));
  for (const w of ws) {
    const ex = w.examples.map((e) => data.sentences.get(e)).find((s) => sentenceHasAudio(s));
    if (ex) out.push({ kind: 'sentence-meaning', sentence: ex.id });
  }
  return out;
}

/** Sentences made only of words you've started, with a recording; short ones for dictation. */
export function listeningItems(data: VocabData, started: Set<string>, n: number, rng: () => number, avoid = new Set<string>()): SItem[] {
  const ok = [...data.sentences.values()].filter((s) => sentenceHasAudio(s) && s.words.length > 0 && s.words.every((w) => started.has(w)) && !avoid.has(s.id));
  const picked = shuffle(ok, rng).slice(0, n);
  return picked.map((s, i) =>
    i % 2 === 0 && [...s.hanzi].length <= 10 ? { kind: 'sentence-dictation', sentence: s.id } : { kind: 'sentence-meaning', sentence: s.id },
  );
}

export interface PlanInput {
  mode: SessionMode;
  /** Due card ids, most urgent first (from the review queue). */
  reviews: string[];
  /** New word ids allowed today, in learning order. */
  newWords: string[];
  data: VocabData;
  /** Words with any card started. */
  started: Set<string>;
  /** A Tone Gym round's worth of items, weighted to your weak spots. */
  tones: GymItem[];
  mic: boolean;
  now: number;
  rng?: () => number;
}

export const QUICK = { reviews: 24, toneEvery: 4, tones: 6, newWhenFew: 3, fewReviews: 8 };
export const DEEP = { reviews: 80, newWords: 10, listening: 8, tones: 20 };

export function planSession(p: PlanInput): SessionPlan {
  const rng = p.rng ?? Math.random;
  const reviewItems = p.reviews.map((c) => reviewItem(c, p.data)).filter((x): x is SItem => !!x);
  const blocks: Block[] = [];
  if (p.mode === 'quick') {
    const revs = reviewItems.slice(0, QUICK.reviews);
    const tones = p.tones.slice(0, QUICK.tones);
    const items: SItem[] = [];
    let t = 0;
    revs.forEach((r, i) => {
      items.push(r);
      if ((i + 1) % QUICK.toneEvery === 0 && t < tones.length) items.push({ kind: 'tone', gym: tones[t++] });
    });
    if (revs.length) blocks.push({ id: 'reviews', items });
    if (revs.length < QUICK.fewReviews && p.newWords.length) blocks.push({ id: 'new', items: newWordItems(p.newWords.slice(0, QUICK.newWhenFew), p.data, rng) });
    const rest = tones.slice(t).map((g): SItem => ({ kind: 'tone', gym: g }));
    if (rest.length) blocks.push({ id: 'tones', items: rest });
  } else {
    if (reviewItems.length) blocks.push({ id: 'reviews', items: reviewItems.slice(0, DEEP.reviews) });
    if (p.newWords.length) blocks.push({ id: 'new', items: newWordItems(p.newWords.slice(0, DEEP.newWords), p.data, rng) });
    const started = new Set([...p.started, ...p.newWords.slice(0, DEEP.newWords)]);
    const listening = listeningItems(p.data, started, DEEP.listening, rng);
    if (listening.length) blocks.push({ id: 'listening', items: listening });
    // Speaking (if the microphone is on) arrives with step 9.
    void p.mic;
    if (p.tones.length) blocks.push({ id: 'tones', items: p.tones.slice(0, DEEP.tones).map((g): SItem => ({ kind: 'tone', gym: g })) });
  }
  return { id: `${p.now.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`, mode: p.mode, blocks, createdAt: p.now };
}

export function itemCount(plan: SessionPlan): number {
  return plan.blocks.reduce((n, b) => n + b.items.length, 0);
}
