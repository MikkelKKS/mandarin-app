import { DEFAULT_SETTINGS, db, type Settings } from '../db/db';
import { useLive } from './useLive';

let cached: Settings = DEFAULT_SETTINGS;

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get('me');
  cached = { ...DEFAULT_SETTINGS, ...(row ?? {}) };
  return cached;
}

/** One-off changes to saved settings when defaults change (runs once per device). */
export async function migrateSettings(): Promise<void> {
  // Redesign (27 Oct 2026): strict tone grading becomes the default, once, for existing settings too.
  if (!(await db.meta.get('migrated:strict-tones'))?.value) {
    await db.meta.put({ key: 'migrated:strict-tones', value: true });
    if (await db.settings.get('me')) await updateSettings({ strictTones: true });
  }
  // v1 (11 Oct) briefly switched everyone to slow audio; v2 switches it back now the cut-off is fixed.
  if ((await db.meta.get('migrated:normal-again'))?.value) return;
  await db.meta.put({ key: 'migrated:normal-again', value: true });
  const row = await db.settings.get('me');
  const v1 = (await db.meta.get('migrated:slow-default'))?.value;
  if (row && v1 && row.audioSpeed === 'slow') await updateSettings({ audioSpeed: 'normal' });
  if (row && row.toneFocus === undefined) await updateSettings({ toneFocus: true });
}

/** Last known settings, for non-React code (audio, sound effects). */
export function currentSettings(): Settings {
  return cached;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await loadSettings()), ...patch };
  cached = next;
  await db.settings.put({ ...next, id: 'me', updatedAt: Date.now() });
  if (patch.theme) applyTheme(patch.theme);
}

export function useSettings(): Settings {
  const s = useLive(async () => loadSettings(), [], cached);
  return s;
}

export function applyTheme(theme: Settings['theme']): void {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage unavailable */
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** "Can't listen now": hide audio-only exercises for an hour. Device-local. */
export async function setQuietUntil(until: number): Promise<void> {
  await db.meta.put({ key: 'quietUntil', value: until });
}

/** Speaking exercises are on, supported, and not paused with "Can't speak now". */
let speakPausedUntil = 0;
export function speakingActive(): boolean {
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  return cached.speaking && supported && Date.now() > speakPausedUntil;
}
export async function setSpeakPausedUntil(until: number): Promise<void> {
  speakPausedUntil = until;
  await db.meta.put({ key: 'speakPausedUntil', value: until });
}
export async function loadSpeakPause(): Promise<void> {
  speakPausedUntil = ((await db.meta.get('speakPausedUntil'))?.value as number) ?? 0;
}
export function useSpeakPausedUntil(): number {
  return useLive(async () => ((await db.meta.get('speakPausedUntil'))?.value as number) ?? 0, [], 0);
}

export function useQuietUntil(): number {
  return useLive(async () => ((await db.meta.get('quietUntil'))?.value as number) ?? 0, [], 0);
}
