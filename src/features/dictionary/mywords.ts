/**
 * "Learn next": put an HSK word from the dictionary (or a story or song) at
 * the front of your new words, so your next session teaches it. The list is
 * part of the synced settings.
 */
import { db } from '../../db/db';
import { isStartedState, useWordStates } from '../../lib/knowledge';
import { currentSettings, loadSettings, updateSettings, useSettings } from '../../lib/settings';
import { loadVocab, useVocab, type VocabRow } from '../../lib/vocabData';

/** Pinyin compared with tones (spaces and apostrophes ignored), or without them. */
const withTones = (p: string) => p.toLowerCase().replace(/[\s'’·-]/g, '');
const toneless = (p: string) => withTones(p).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Pure: the HSK word for a dictionary entry (same characters; same pinyin when there's a choice). */
export function matchHsk(vocab: VocabRow[], e: { hanzi: string; pinyin: string }): VocabRow | undefined {
  const same = vocab.filter((w) => w.hanzi === e.hanzi);
  if (same.length <= 1) return same[0];
  return same.find((w) => withTones(w.pinyin) === withTones(e.pinyin)) ?? same.find((w) => toneless(w.pinyin) === toneless(e.pinyin)) ?? same[0];
}

export async function learnNext(id: string): Promise<void> {
  const s = await loadSettings();
  if (!s.nextWords.includes(id)) await updateSettings({ nextWords: [...s.nextWords, id] });
}

export async function dontLearnNext(id: string): Promise<void> {
  const s = await loadSettings();
  await updateSettings({ nextWords: s.nextWords.filter((x) => x !== id) });
}

export type LearnState = 'none' | 'queued' | 'started' | 'not-hsk';

/** For a dictionary entry: its HSK word and where it stands. */
export function useLearnState(e: { hanzi: string; pinyin: string } | undefined): { word?: VocabRow; state: LearnState } {
  const vocab = useVocab();
  const states = useWordStates();
  const { nextWords } = useSettings();
  if (!e || !vocab || !states) return { state: 'not-hsk' };
  const word = matchHsk(vocab, e);
  if (!word) return { state: 'not-hsk' };
  if (isStartedState(states.get(word.id))) return { word, state: 'started' };
  return { word, state: nextWords.includes(word.id) ? 'queued' : 'none' };
}

/** The words waiting at the front of the line that you haven't started yet. */
export function useQueuedWords(): VocabRow[] {
  const vocab = useVocab();
  const states = useWordStates();
  const { nextWords } = useSettings();
  if (!vocab || !states) return [];
  const byId = new Map(vocab.map((w) => [w.id, w]));
  return nextWords.map((id) => byId.get(id)).filter((w): w is VocabRow => !!w && !isStartedState(states.get(w.id)));
}

/**
 * Once per device: words added with the old "Add to my practice" become
 * "learn next" words (HSK words only; their old cards never reached a session).
 */
export async function migrateMyWords(): Promise<void> {
  if ((await db.meta.get('migrated:my-words'))?.value) return;
  const row = await db.customPacks.get('my-words');
  const old = ((row?.pack as { words?: Array<{ hanzi: string; pinyin: string }> } | undefined)?.words ?? []);
  if (old.length) {
    const vocab = await loadVocab();
    await loadSettings();
    const ids = old.map((w) => matchHsk(vocab, w)?.id).filter((x): x is string => !!x);
    const next = [...new Set([...currentSettings().nextWords, ...ids])];
    await updateSettings({ nextWords: next });
  }
  await db.reviewItems.where('id').startsWith('p-my-').delete();
  await db.meta.put({ key: 'migrated:my-words', value: true });
}
