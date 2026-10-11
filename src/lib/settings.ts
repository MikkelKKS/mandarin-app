import { DEFAULT_SETTINGS, db, type Settings } from '../db/db';
import { useLive } from './useLive';

let cached: Settings = DEFAULT_SETTINGS;

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get('me');
  cached = { ...DEFAULT_SETTINGS, ...(row ?? {}) };
  return cached;
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

export function useQuietUntil(): number {
  return useLive(async () => ((await db.meta.get('quietUntil'))?.value as number) ?? 0, [], 0);
}
