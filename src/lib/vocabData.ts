/**
 * The HSK 3.0 word list in the app, loaded on demand (its own cached chunk).
 */
import { useEffect, useState } from 'react';

export interface VocabRow {
  id: string;
  hanzi: string;
  pinyin: string;
  gloss: string[];
  level: number;
  order: number;
  examples: string[];
}

let cache: Promise<VocabRow[]> | null = null;

export function loadVocab(): Promise<VocabRow[]> {
  cache ??= import('virtual:vocab').then((m) =>
    m.default
      .map(([id, hanzi, pinyin, gloss, level, order, examples]) => ({ id, hanzi, pinyin, gloss, level, order, examples }))
      .sort((a, b) => a.order - b.order),
  );
  return cache;
}

export function useVocab(): VocabRow[] | null {
  const [v, setV] = useState<VocabRow[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadVocab().then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, []);
  return v;
}
