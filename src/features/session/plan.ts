/**
 * Session plans (CLAUDE.md §7).
 * - Quick (phone, about 5 minutes): due reviews with Tone Gym items mixed in;
 *   a few new words when little is due.
 * - Deep (PC, 20+ minutes): reviews → new words → listening and dictation →
 *   (speaking, step 9) → a Tone Gym round.
 * Pure: everything it needs is passed in.
 */
import { samePinyin, sharesMeaning } from '../../lib/gloss';
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
  | { kind: 'sentence-pinyin'; sentence: string }
  | { kind: 'tone'; gym: GymItem }
  | { kind: 'speak'; word: string };

export type BlockId = 'reviews' | 'new' | 'listening' | 'writing' | 'speaking' | 'tones';
export const BLOCK_TITLE: Record<BlockId, string> = {
  reviews: 'Reviews',
  new: 'New words',
  listening: 'Listening',
  writing: 'Say it in pinyin',
  speaking: 'Speaking',
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
    case 'speak':
      return `${it.word}#sp`;
    default:
      return null;
  }
}

/** A word or sentence the app has a recording for. */
const wordHasAudio = (w: VocabRow | undefined) => !!w && (w.azure || !!w.course);
const sentenceHasAudio = (s: SentenceRow | undefined) => !!s && (s.azure || s.course);

export function reviewItem(card: string, data: VocabData, mic = false): SItem | null {
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
    sp: mic && wordHasAudio(w) ? { kind: 'speak', word: w.id } : null,
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

/**
 * Three other words for a "what does it mean?" choice: close in level, sharing
 * no meaning term with the word (no near-synonyms) and not sounding exactly
 * like it (no homophones), nor like each other.
 */
export function distractors(word: Pick<VocabRow, 'id' | 'order' | 'gloss' | 'pinyin'>, words: VocabRow[], rng: () => number, n = 3): string[] {
  const near = shuffle(
    words.filter((w) => w.id !== word.id && Math.abs(w.order - word.order) < 400 && w.gloss[0] && !samePinyin(w.pinyin, word.pinyin) && !sharesMeaning(w.gloss, word.gloss)),
    rng,
  );
  const out: VocabRow[] = [];
  for (const w of near) {
    if (out.some((o) => sharesMeaning(o.gloss, w.gloss) || samePinyin(o.pinyin, w.pinyin))) continue;
    out.push(w);
    if (out.length >= n) break;
  }
  return out.map((w) => w.id);
}

/** How many other words are introduced before a word's first "what does it mean?" question. */
export const CHOOSE_GAP = 3;

/**
 * New words: meet each one (intro); its first "what does it mean?" comes after
 * the next few words' intros, so it tests memory, not the last five seconds.
 * Then type each twice (by ear, from English), then hear it in a sentence.
 */
export function newWordItems(words: string[], data: VocabData, rng: () => number): SItem[] {
  const ws = words.map((id) => data.byId.get(id)).filter((w): w is VocabRow => !!w);
  const out: SItem[] = [];
  const choose = (w: VocabRow): SItem[] => (wordHasAudio(w) ? [{ kind: 'choose-meaning', word: w.id, options: shuffle([w.id, ...distractors(w, data.words, rng)], rng) }] : []);
  ws.forEach((w, i) => {
    out.push({ kind: 'intro', word: w.id });
    if (i >= CHOOSE_GAP) out.push(...choose(ws[i - CHOOSE_GAP]));
  });
  for (const w of ws.slice(Math.max(0, ws.length - CHOOSE_GAP))) out.push(...choose(w));
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

/**
 * Sentence production: English → pinyin, from sentences made only of words
 * you've started, with your newest words first (sentences that use them),
 * short enough to type (at most 12 characters).
 */
export function productionItems(data: VocabData, started: Set<string>, newest: string[], n: number, rng: () => number, avoid = new Set<string>()): SItem[] {
  const rank = new Map(newest.map((w, i) => [w, i]));
  const ok = [...data.sentences.values()].filter(
    (s) => s.words.length > 1 && s.english[0] && [...s.hanzi].length <= 12 && s.words.every((w) => started.has(w)) && !avoid.has(s.id),
  );
  // Best rank of a newest word in the sentence (lower = newer), random order within the same rank.
  const score = (s: SentenceRow) => Math.min(...s.words.map((w) => rank.get(w) ?? 1e6));
  const picked = shuffle(ok, rng)
    .sort((a, b) => score(a) - score(b))
    .slice(0, n);
  return picked.map((s) => ({ kind: 'sentence-pinyin', sentence: s.id }));
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
  /** Words to start speaking practice on (already known by ear), most useful first. */
  speakNew?: string[];
  /** Recently started words, newest first (for the sentences to type). */
  newest?: string[];
  now: number;
  rng?: () => number;
}

/** What a session will hold, for the Home screen (the same caps as planSession). */
export function sessionPreview(mode: SessionMode, due: number, fresh: number, tones: boolean): { reviews: number; newWords: number; tones: number } {
  if (mode === 'quick') {
    const reviews = Math.min(due, QUICK.reviews);
    return { reviews, newWords: reviews < QUICK.fewReviews ? Math.min(fresh, QUICK.newWhenFew) : 0, tones: tones ? QUICK.tones : 0 };
  }
  return { reviews: Math.min(due, DEEP.reviews), newWords: Math.min(fresh, DEEP.newWords), tones: tones ? DEEP.tones : 0 };
}

export const QUICK = { reviews: 24, toneEvery: 4, tones: 6, newWhenFew: 3, fewReviews: 8 };
export const DEEP = { reviews: 80, newWords: 10, listening: 8, writing: 4, speaking: 8, speakNew: 4, tones: 12 };

export function planSession(p: PlanInput): SessionPlan {
  const rng = p.rng ?? Math.random;
  const reviewItems = p.reviews.map((c) => reviewItem(c, p.data, p.mic)).filter((x): x is SItem => !!x);
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
    // Say it in pinyin: a few sentences from English, using your newest words.
    const heard = new Set(listening.map((x) => ('sentence' in x ? x.sentence : '')));
    const writing = productionItems(p.data, started, [...p.newWords.slice(0, DEEP.newWords), ...(p.newest ?? [])], DEEP.writing, rng, heard);
    if (writing.length) blocks.push({ id: 'writing', items: writing });
    // Speaking, if the microphone is on: due speaking cards and a few new ones.
    if (p.mic) {
      const speak = [
        ...blocks.flatMap((b) => (b.id === 'reviews' ? b.items.filter((x) => x.kind === 'speak') : [])),
        ...(p.speakNew ?? [])
          .filter((w) => p.data.byId.has(w) && wordHasAudio(p.data.byId.get(w)))
          .slice(0, DEEP.speakNew)
          .map((w): SItem => ({ kind: 'speak', word: w })),
      ].slice(0, DEEP.speaking);
      const reviewsBlock = blocks.find((b) => b.id === 'reviews');
      if (reviewsBlock) reviewsBlock.items = reviewsBlock.items.filter((x) => x.kind !== 'speak');
      if (speak.length) blocks.push({ id: 'speaking', items: speak });
    }
    if (p.tones.length) blocks.push({ id: 'tones', items: p.tones.slice(0, DEEP.tones).map((g): SItem => ({ kind: 'tone', gym: g })) });
  }
  return { id: `${p.now.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`, mode: p.mode, blocks: blocks.filter((b) => b.items.length), createdAt: p.now };
}

export function itemCount(plan: SessionPlan): number {
  return plan.blocks.reduce((n, b) => n + b.items.length, 0);
}
