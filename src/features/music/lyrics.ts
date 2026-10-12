/**
 * Lyrics from LRCLIB (https://lrclib.net), a free, open lyrics database.
 * Fetched on this device when needed and kept in memory only: lyrics are
 * never stored in the app's code, database or sync.
 */
import type { Track } from './spotify';

export interface LyricLine {
  /** Start time in ms (synced lyrics), or null. */
  t: number | null;
  text: string;
}
export interface Lyrics {
  lines: LyricLine[];
  synced: boolean;
}

const BASE = 'https://lrclib.net/api';
const cache = new Map<string, Promise<Lyrics | null>>();

interface LrcRecord {
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/** "[01:23.45] text" lines → timed lines. */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000), text });
  }
  return out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

/** Drop "(Live)", "- Remastered", "feat." and similar from titles for matching. */
export function cleanTitle(name: string): string {
  return name
    .replace(/[(（【[].*?[)）】\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\bfeat\..*$/i, '')
    .trim();
}

function toLyrics(r: LrcRecord): Lyrics | null {
  if (r.instrumental) return null;
  if (r.syncedLyrics) {
    const lines = parseLrc(r.syncedLyrics);
    if (lines.some((l) => l.text)) return { lines, synced: true };
  }
  if (r.plainLyrics) return { lines: r.plainLyrics.split('\n').map((text) => ({ t: null, text: text.trim() })), synced: false };
  return null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lyrics service error ${res.status}`);
  return (await res.json()) as T;
}

async function lookup(track: Track): Promise<Lyrics | null> {
  const title = cleanTitle(track.name) || track.name;
  const artist = track.artists[0] ?? '';
  const secs = Math.round(track.durationMs / 1000);
  const exact = await getJson<LrcRecord>(
    `${BASE}/get?${new URLSearchParams({ track_name: title, artist_name: artist, duration: String(secs) })}`,
  );
  if (exact) return toLyrics(exact);
  const found = (await getJson<LrcRecord[]>(`${BASE}/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`)) ?? [];
  const best = found
    .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics) && Math.abs(r.duration - secs) <= 8)
    .sort((a, b) => Math.abs(a.duration - secs) - Math.abs(b.duration - secs) || Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics))[0];
  return best ? toLyrics(best) : null;
}

export function fetchLyrics(track: Track): Promise<Lyrics | null> {
  let p = cache.get(track.id);
  if (!p) {
    p = lookup(track).catch((e) => {
      cache.delete(track.id);
      throw e;
    });
    cache.set(track.id, p);
  }
  return p;
}
