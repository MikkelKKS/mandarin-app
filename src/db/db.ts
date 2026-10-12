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
  strictTones: false,
  audioSpeed: 'normal',
  voice: 'alternate',
  sound: true,
  toneColors: true,
  toneFocus: true,
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
  }
}

export const db = new MandarinDB();

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
