import type { Voice } from '../../content/audioPaths';
import type { Verdict } from '../../lib/pinyinAnswer';

interface Base {
  key: string;
  /** Present when the exercise needs sound to be answered. */
  voice?: Voice;
}

export type Exercise =
  | (Base & { kind: 'intro'; wordId: string })
  | (Base & { kind: 'listen-meaning'; itemId: string; options: string[]; answer: number })
  | (Base & { kind: 'listen-sentence'; itemId: string; options: string[]; answer: number })
  | (Base & { kind: 'listen-tiles'; sentenceId: string; tiles: string[] })
  | (Base & { kind: 'dictation'; itemId: string })
  | (Base & { kind: 'tone-id'; itemId: string })
  | (Base & { kind: 'minimal-pair'; a: string; b: string; answer: 0 | 1; hint?: string })
  | (Base & { kind: 'what-would-you-say'; exchangeId: string; options: string[]; answer: number })
  | (Base & { kind: 'reply-type'; exchangeId: string })
  | (Base & { kind: 'en-to-pinyin'; itemId: string })
  | (Base & { kind: 'fill-gap'; sentenceId: string; gap: number })
  | (Base & { kind: 'build-sentence'; sentenceId: string; tiles: string[] })
  | (Base & { kind: 'match-pairs'; wordIds: string[]; mode: 'pinyin' | 'meaning' })
  | (Base & { kind: 'pick-character'; wordId: string; options: string[]; answer: number })
  | (Base & { kind: 'read-sentence'; sentenceId: string; options: string[]; answer: number })
  | (Base & { kind: 'repeat'; itemId: string });

export type ExerciseKind = Exercise['kind'];

/** Exercises that can't be done without sound. */
export const AUDIO_ONLY: ReadonlySet<ExerciseKind> = new Set([
  'listen-meaning',
  'listen-sentence',
  'listen-tiles',
  'dictation',
  'tone-id',
  'minimal-pair',
  'reply-type',
]);

export const CATEGORY: Record<ExerciseKind, 'listening' | 'pinyin' | 'recognition' | 'other'> = {
  intro: 'other',
  'listen-meaning': 'listening',
  'listen-sentence': 'listening',
  'listen-tiles': 'listening',
  dictation: 'listening',
  'tone-id': 'listening',
  'minimal-pair': 'listening',
  'what-would-you-say': 'listening',
  'reply-type': 'pinyin',
  'en-to-pinyin': 'pinyin',
  'fill-gap': 'pinyin',
  'build-sentence': 'pinyin',
  'match-pairs': 'recognition',
  'pick-character': 'recognition',
  'read-sentence': 'recognition',
  repeat: 'other',
};

/** What an exercise component reports when checked. */
export interface Outcome {
  verdict: Verdict;
  /** Shown as the correct answer in the feedback panel. */
  answer?: { hanzi?: string; pinyin?: string; english?: string; text?: string };
  /** Extra note, e.g. "Missing tones" or "Typo: …". */
  note?: string;
  /** Per-item verdicts for review scheduling (defaults to all items of the exercise). */
  items?: Array<{ id: string; verdict: Verdict }>;
  tones?: { expected: string; given: string };
  /** A typed answer with different wording: the learner may mark it as right ("I was right"). */
  canOverride?: boolean;
}
