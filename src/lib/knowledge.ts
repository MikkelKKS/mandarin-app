/**
 * What you know, in one place. Every part of the app (sessions, Stats,
 * Conversations, Read, Music) reads word knowledge from the same review cards:
 * a word is as far along as its weakest listening/typing card. Course words map
 * to their HSK 3.0 word, so learning a word in either place counts in both.
 */
import { db, type ReviewItemRow } from '../db/db';
import { cardState, newWordId, parseCardId, wordState, type WordState } from './review';
import { useLive } from './useLive';
import type { VocabRow } from './vocabData';

/** Pure: state per word id (HSK ids; old course ids for course words without an HSK match). */
export function wordStates(cards: ReviewItemRow[]): Map<string, WordState> {
  const byWord = new Map<string, ReviewItemRow[]>();
  const legacy = new Map<string, ReviewItemRow>();
  for (const c of cards) {
    const p = parseCardId(c.id);
    if (p) {
      if (p.facet !== 'sp') byWord.set(p.word, [...(byWord.get(p.word) ?? []), c]);
    } else if (/^w-/.test(c.id)) legacy.set(c.id, c);
  }
  const out = new Map<string, WordState>();
  for (const [w, cs] of byWord) out.set(w, wordState(cs));
  // Course words that have no HSK word keep their own single card.
  for (const [id, c] of legacy) if (!newWordId(id)) out.set(id, cardState(c));
  return out;
}

/** State of a course word (w-…), through its HSK word when it has one. */
export function courseWordState(courseId: string, states: Map<string, WordState>): WordState {
  return states.get(newWordId(courseId) ?? courseId) ?? 'new';
}

/** In review (young or mature): you know it. */
export const isKnownState = (s: WordState | undefined) => s === 'young' || s === 'mature';
/** Met at least once. */
export const isStartedState = (s: WordState | undefined) => !!s && s !== 'new';

export function useWordStates(): Map<string, WordState> | null {
  const cards = useLive(() => db.reviewItems.toArray(), [], null as ReviewItemRow[] | null);
  return cards ? wordStates(cards) : null;
}

export async function loadWordStates(): Promise<Map<string, WordState>> {
  return wordStates(await db.reviewItems.toArray());
}

/** Pure: characters of the words you know and the ones you're learning (for reading lyrics and stories). */
export function hanziKnowledge(vocab: VocabRow[], states: Map<string, WordState>): { known: Set<string>; learning: Set<string> } {
  const known = new Set<string>();
  const learning = new Set<string>();
  for (const w of vocab) {
    const s = states.get(w.id);
    if (isKnownState(s)) known.add(w.hanzi);
    else if (isStartedState(s)) learning.add(w.hanzi);
  }
  for (const h of known) learning.delete(h);
  return { known, learning };
}

/** Pure: the HSK level you're working on: the first one with less than 80% of its words started (1–7). */
export function currentLevel(vocab: VocabRow[], states: Map<string, WordState>): number {
  for (let level = 1; level <= 7; level++) {
    const ws = vocab.filter((w) => w.level === level);
    if (!ws.length) continue;
    const started = ws.filter((w) => isStartedState(states.get(w.id))).length;
    if (started / ws.length < 0.8) return level;
  }
  return 7;
}
