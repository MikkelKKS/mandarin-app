/**
 * Short grammar notes for function words (了, 的/得/地, 过, 把, 被, 就, 才…),
 * shown when the word is introduced and from its word card. Content:
 * content/grammar-notes.json. Each example is recorded with Azure as its `id`.
 */
import data from '../../content/grammar-notes.json';
import { toNumeric } from './pinyin';

export interface GrammarNote {
  key: string;
  title: string;
  note: string;
  zh: string;
  py: string;
  en: string;
  /** Audio id of the example sentence. */
  id: string;
}

const norm = (numeric: string) => numeric.replace(/\s+/g, '').toLowerCase();

/** Audio id for a note's example: g-<character code points>-<numeric pinyin>. Same rule in scripts/azure-tts.ts. */
export function grammarAudioId(key: string): string {
  const [hanzi, numeric] = key.split('|');
  return `g-${[...hanzi].map((c) => c.codePointAt(0)!.toString(16)).join('')}-${norm(numeric)}`;
}

const byKey = new Map<string, GrammarNote>(
  (data.notes as Omit<GrammarNote, 'id'>[]).map((n) => {
    const [hanzi, numeric] = n.key.split('|');
    return [`${hanzi}|${norm(numeric)}`, { ...n, id: grammarAudioId(n.key) }];
  }),
);

/** The grammar note for a word (characters + pinyin with tone marks), if it has one. */
export function grammarFor(w: { hanzi: string; pinyin: string } | undefined | null): GrammarNote | undefined {
  if (!w) return undefined;
  return byKey.get(`${w.hanzi}|${norm(toNumeric(w.pinyin))}`);
}

export const allGrammarNotes = (): GrammarNote[] => [...byKey.values()];
