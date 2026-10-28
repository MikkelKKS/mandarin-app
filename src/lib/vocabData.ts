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
  /** An Azure (Xiaoxiao) recording exists. */
  azure: boolean;
  /** Id in the old hand-written course, whose older recordings (two voices) exist. */
  course?: string;
  /** Parts of speech from the HSK list (noun, verb, particle…). */
  pos?: string[];
  /** A short everyday meaning for exercises (HSK 1–4); the full CC-CEDICT glosses stay in `gloss`. */
  short?: string;
}

let cache: Promise<VocabRow[]> | null = null;

export function loadVocab(): Promise<VocabRow[]> {
  cache ??= import('virtual:vocab').then((m) =>
    m.default
      .map(([id, hanzi, pinyin, gloss, level, order, examples, azure, course, pos, short]) => ({
        id,
        hanzi,
        pinyin,
        gloss,
        level,
        order,
        examples,
        azure: azure === 1,
        course: course || undefined,
        pos,
        short: short || undefined,
      }))
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

export interface SentenceRow {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string[];
  words: string[];
  azure: boolean;
  /** Written for the course (has older recordings too). */
  course: boolean;
}

let sentenceCache: Promise<Map<string, SentenceRow>> | null = null;

export function loadSentences(): Promise<Map<string, SentenceRow>> {
  sentenceCache ??= import('virtual:sentences').then(
    (m) =>
      new Map(
        m.default.map(([id, hanzi, pinyin, english, words, azure, course]) => [
          id,
          { id, hanzi, pinyin, english, words, azure: azure === 1, course: course === 1 },
        ]),
      ),
  );
  return sentenceCache;
}

/** Words and example sentences together, for sessions. */
export interface VocabData {
  words: VocabRow[];
  byId: Map<string, VocabRow>;
  sentences: Map<string, SentenceRow>;
}

let dataCache: Promise<VocabData> | null = null;
export function loadVocabData(): Promise<VocabData> {
  dataCache ??= Promise.all([loadVocab(), loadSentences()]).then(([words, sentences]) => ({
    words,
    byId: new Map(words.map((w) => [w.id, w])),
    sentences,
  }));
  return dataCache;
}

export function useVocabData(): VocabData | null {
  const [v, setV] = useState<VocabData | null>(null);
  useEffect(() => {
    let live = true;
    void loadVocabData().then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, []);
  return v;
}

/**
 * A short meaning for exercises: the first gloss without bracketed notes,
 * plus the second when both are short ("to eat; to have a meal").
 */
export function shortGloss(gloss: string[]): string {
  const clean = gloss.map((g) => g.replace(/\([^)]*\)/g, '').replace(/~/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!clean.length) return gloss[0] ?? '';
  const first = clean[0];
  return clean[1] && first.length < 18 && first.length + clean[1].length < 40 ? `${first}; ${clean[1]}` : first;
}
