/**
 * Local database (IndexedDB via Dexie) — the source of truth on each device.
 * Every synced row carries `updatedAt` (ms since epoch) for last-write-wins.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Verdict } from '../lib/pinyinAnswer';

export interface ProgressRow {
  id: string; // node id, or "unit:<unitId>"
  kind: 'node' | 'unit';
  mastery: number; // 0 to 5 for nodes
  completions: number;
  bestAccuracy: number; // 0 to 1
  testedOut?: boolean;
  updatedAt: number;
}

/** FSRS card state, serialised (dates as epoch ms). */
export interface ReviewItemRow {
  id: string; // word or sentence id
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview?: number;
  /** Word facet cards (id "<word id>#<facet>"): the word and the skill. */
  word?: string;
  facet?: 'lm' | 'lp' | 'mp' | 'sp';
  /** Copied from this old course card when the facets were introduced. */
  migratedFrom?: string;
  updatedAt: number;
}

export interface ReviewLogRow {
  id: string; // uuid
  itemId: string;
  exercise: string;
  verdict: Verdict;
  at: number;
  nodeId?: string;
  /** For tone mistakes: expected vs given tones, e.g. "3-3" vs "2-3". */
  tones?: { expected: string; given: string };
  // Full FSRS review data (from the redesign on), so the scheduler can be optimised later.
  /** Card reviewed ("<word id>#<facet>" or a sentence id). */
  card?: string;
  /** FSRS grade: 1 Again, 2 Hard, 3 Good, 4 Easy. */
  rating?: number;
  /** Card state before the review: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  stateBefore?: number;
  /** Days since the card's previous review. */
  elapsedDays?: number;
  /** Interval given by this review, in days. */
  scheduledDays?: number;
  stabilityAfter?: number;
  /** Time taken to answer. */
  ms?: number;
  /** The grade was changed by hand. */
  override?: boolean;
  /** A later override replaced this entry (kept, since logs are append-only). */
  replaced?: boolean;
  updatedAt: number;
}

export type PinyinDisplay = 'always' | 'hover' | 'tap' | 'never';
export type VoicePref = 'alternate' | 'f' | 'm';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  speaking: boolean;
  pinyinDisplay: PinyinDisplay;
  strictTones: boolean;
  audioSpeed: 'normal' | 'slow';
  voice: VoicePref;
  sound: boolean;
  toneColors: boolean;
  /** More tone exercises in lessons. */
  toneFocus: boolean;
  /** FSRS desired retention (0.7 to 0.97). */
  retention: number;
  /** Daily limits. */
  newPerDay: number;
  reviewsPerDay: number;
  theme: Theme;
}

export interface SettingsRow extends Settings {
  id: 'me';
  updatedAt: number;
}

export interface CustomPackRow {
  id: string;
  title: string;
  pack: unknown;
  importedAt: number;
  updatedAt: number;
}

export interface GameScoreRow {
  id: string; // game id
  best: number;
  plays: number;
  updatedAt: number;
}

/** Device-local values that are never synced. */
export interface MetaRow {
  key: string;
  value: unknown;
}

export const DEFAULT_SETTINGS: Settings = {
  speaking: false,
  pinyinDisplay: 'always',
  strictTones: true,
  audioSpeed: 'normal',
  voice: 'alternate',
  sound: true,
  toneColors: true,
  toneFocus: true,
  retention: 0.9,
  newPerDay: 10,
  reviewsPerDay: 200,
  theme: 'system',
};

export class MandarinDB extends Dexie {
  progress!: EntityTable<ProgressRow, 'id'>;
  reviewItems!: EntityTable<ReviewItemRow, 'id'>;
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>;
  settings!: EntityTable<SettingsRow, 'id'>;
  customPacks!: EntityTable<CustomPackRow, 'id'>;
  gameScores!: EntityTable<GameScoreRow, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'mandarin') {
    super(name);
    this.version(1).stores({
      progress: 'id, kind, updatedAt',
      reviewItems: 'id, due, updatedAt',
      reviewLogs: 'id, itemId, at, verdict, updatedAt',
      settings: 'id, updatedAt',
      customPacks: 'id, updatedAt',
      gameScores: 'id, updatedAt',
      meta: 'key',
    });
    // Redesign: review logs can be looked up by card.
    this.version(2).stores({ reviewLogs: 'id, itemId, card, at, verdict, updatedAt' });
  }
}

export const db = new MandarinDB();

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
