/**
 * Matching songs across services (pure, shared by the app and scripts/build-songs.ts):
 * LRCLIB records ↔ titles and artists ↔ Spotify tracks. Titles differ a lot between
 * services: romanised vs Chinese artist names, traditional vs simplified characters,
 * "(Live)", "- Remastered", "feat." and so on.
 */

/** "[01:23.45] text" lines → timed lines. */
export interface LyricLine {
  /** Start time in ms (synced lyrics), or null. */
  t: number | null;
  text: string;
}
export interface Lyrics {
  lines: LyricLine[];
  synced: boolean;
}

export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000), text });
  }
  return out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

/** An LRCLIB record (https://lrclib.net/docs). */
export interface LrcRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export function lyricsOf(r: Pick<LrcRecord, 'instrumental' | 'plainLyrics' | 'syncedLyrics'>): Lyrics | null {
  if (r.instrumental) return null;
  if (r.syncedLyrics) {
    const lines = parseLrc(r.syncedLyrics);
    if (lines.some((l) => l.text)) return { lines, synced: true };
  }
  if (r.plainLyrics) return { lines: r.plainLyrics.split('\n').map((text) => ({ t: null, text: text.trim() })), synced: false };
  return null;
}

/** Drop "(Live)", "- Remastered", "feat." and similar from titles for matching. */
export function cleanTitle(name: string): string {
  return name
    .replace(/[(（【[《].*?[)）】\]》]/g, '')
    .replace(/\s+[-–—]\s+.*$/, '')
    .replace(/\b(feat|ft)\..*$/i, '')
    .trim();
}

export function toSimplified(text: string, t2s: Record<string, string>): string {
  let out = '';
  for (const c of text) out += t2s[c] ?? c;
  return out;
}

/** A comparable key: simplified, lower case, letters and characters only. */
export function nameKey(name: string, t2s: Record<string, string> = {}): string {
  return toSimplified(cleanTitle(name) || name, t2s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Do two names mean the same (equal keys, or one contains the other when long enough)? */
export function sameName(a: string, b: string, t2s: Record<string, string> = {}): boolean {
  const x = nameKey(a, t2s);
  const y = nameKey(b, t2s);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length < y.length ? x : y;
  const long = x.length < y.length ? y : x;
  return short.length >= 2 && long.includes(short);
}

export interface NameVariant {
  title: string;
  artist: string;
}

/** A Spotify search result, reduced to what matching needs. */
export interface SpotifyCandidate {
  id: string;
  name: string;
  artists: string[];
  durationMs: number;
}

/**
 * The Spotify track for a song: same title (any stored spelling), duration
 * within `tolerance` seconds; same artist breaks ties. Closest duration wins.
 */
export function pickSpotifyMatch<T extends SpotifyCandidate>(
  candidates: T[],
  song: { duration: number; names: NameVariant[] },
  t2s: Record<string, string> = {},
  tolerance = 5,
): T | null {
  let best: { t: T; score: number } | null = null;
  for (const t of candidates) {
    const off = Math.abs(t.durationMs / 1000 - song.duration);
    if (off > tolerance) continue;
    const title = song.names.some((n) => sameName(t.name, n.title, t2s));
    const artist = song.names.some((n) => t.artists.some((a) => sameName(a, n.artist, t2s)));
    // The title must match; a title in another script (晴天 / Qing Tian) only counts with the same artist and nearly the same length.
    if (!title && !(artist && off <= 2)) continue;
    const score = (title ? 0 : 10) + (artist ? 0 : 6) + off;
    if (!best || score < best.score) best = { t, score };
  }
  return best?.t ?? null;
}

/** The LRCLIB record for a playing track: same title, duration within `tolerance` s; synced lyrics preferred. */
export function pickLrcMatch<T extends LrcRecord>(records: T[], song: { duration: number; names: NameVariant[] }, t2s: Record<string, string> = {}, tolerance = 8): T | null {
  const ok = records.filter(
    (r) =>
      !r.instrumental &&
      (r.syncedLyrics || r.plainLyrics) &&
      Math.abs(r.duration - song.duration) <= tolerance &&
      song.names.some((n) => sameName(r.trackName, n.title, t2s)),
  );
  ok.sort(
    (a, b) =>
      Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics) ||
      Number(song.names.some((n) => sameName(b.artistName, n.artist, t2s))) - Number(song.names.some((n) => sameName(a.artistName, n.artist, t2s))) ||
      Math.abs(a.duration - song.duration) - Math.abs(b.duration - song.duration),
  );
  return ok[0] ?? null;
}

/** Title and artist spellings worth trying in a search, most likely first, without repeats. */
export function searchVariants(names: NameVariant[], t2s: Record<string, string> = {}): NameVariant[] {
  const seen = new Set<string>();
  const out: NameVariant[] = [];
  for (const n of names) {
    for (const v of [
      { title: cleanTitle(n.title) || n.title, artist: n.artist },
      { title: toSimplified(cleanTitle(n.title) || n.title, t2s), artist: toSimplified(n.artist, t2s) },
    ]) {
      const k = `${v.title}|${v.artist}`;
      if (seen.has(k) || !v.title) continue;
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Retrying fetches

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Retry on network errors, 429 and 5xx, waiting longer each time; 404 and other 4xx fail at once. */
export async function withRetry<T>(fn: () => Promise<T>, opts: { tries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<T> {
  const tries = opts.tries ?? 4;
  const base = opts.baseMs ?? 600;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const status = e instanceof HttpError ? e.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || i === tries - 1) throw e;
      await sleep(base * 2 ** i + Math.floor(Math.random() * 200));
    }
  }
  throw last;
}

/** GET JSON; 404 → null; other errors throw an HttpError (or the network error). */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
  return (await res.json()) as T;
}
