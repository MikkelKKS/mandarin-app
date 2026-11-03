/**
 * Which example sentence to show for a word (IDEAS #18): the one with the
 * fewest words you haven't started yet, so examples follow what you know, not
 * just the fixed HSK order they were picked in at build time.
 */
import type { SentenceRow, VocabData, VocabRow } from './vocabData';

/** More unknown words than this and an optional example is left out. */
export const MAX_UNKNOWN_IN_EXAMPLE = 2;

/** Pure: how many different words in the sentence, other than `word`, aren't in `known`. 0 without a known set. */
export function unknownIn(s: SentenceRow, word: string, known: ReadonlySet<string> | undefined): number {
  if (!known) return 0;
  return new Set(s.words.filter((x) => x !== word && !known.has(x))).size;
}

/** Pure: the word's examples (passing `keep`), easiest for you first; ties keep the build order. */
export function rankExamples(w: VocabRow, data: VocabData, keep: (s: SentenceRow) => boolean = () => true): SentenceRow[] {
  const list = w.examples.map((id) => data.sentences.get(id)).filter((s): s is SentenceRow => !!s && keep(s));
  const n = new Map(list.map((s) => [s.id, unknownIn(s, w.id, data.known)]));
  return list.map((s, i) => ({ s, i })).sort((a, b) => n.get(a.s.id)! - n.get(b.s.id)! || a.i - b.i).map((x) => x.s);
}

/** Pure: the example to show, or undefined when even the easiest has too many words you haven't started. */
export function bestExample(w: VocabRow, data: VocabData, keep?: (s: SentenceRow) => boolean): SentenceRow | undefined {
  const s = rankExamples(w, data, keep)[0];
  return s && unknownIn(s, w.id, data.known) <= MAX_UNKNOWN_IN_EXAMPLE ? s : undefined;
}

/** Pure: the ids of words you've started (any card that's been seen), for `VocabData.known`. */
export function startedWords(cards: Array<{ word?: string; reps: number; state: number }>): Set<string> {
  return new Set(cards.filter((c) => c.word && (c.reps > 0 || c.state !== 0)).map((c) => c.word!));
}
