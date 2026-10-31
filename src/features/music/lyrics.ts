/**
 * Lyrics from LRCLIB (https://lrclib.net), a free, open lyrics database.
 * Fetched on this device when a song is opened, by the exact LRCLIB id from the
 * catalogue (reliable), with retries. Kept in memory and in the service worker's
 * cache; never stored in the app's code, database or sync.
 */
import { getJson, lyricsOf, pickLrcMatch, searchVariants, withRetry, type LrcRecord, type Lyrics, type NameVariant } from './match';

export type { LyricLine, Lyrics } from './match';

const BASE = 'https://lrclib.net/api';
const byId = new Map<number, Promise<Lyrics | null>>();

/** Lyrics of a catalogue song. Retries network errors, rate limits and server errors; null if LRCLIB has none. */
export function lyricsById(id: number, retry: Parameters<typeof withRetry>[1] = {}): Promise<Lyrics | null> {
  let p = byId.get(id);
  if (!p) {
    p = withRetry(() => getJson<LrcRecord>(`${BASE}/get/${id}`), retry)
      .then((r) => (r ? lyricsOf(r) : null))
      .catch((e) => {
        byId.delete(id); // so "Try again" really tries again
        throw e;
      });
    byId.set(id, p);
  }
  return p;
}

/** Letters, digits and spaces only: punctuation like "！" or "?" can make LRCLIB's search fail. */
export const searchText = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The LRCLIB searches to try for a song, most precise first, without repeats. */
export function lyricSearches(names: NameVariant[], t2s: Record<string, string>): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  const add = (p: Record<string, string>) => {
    const k = JSON.stringify(p);
    if (!seen.has(k) && Object.values(p).every(Boolean)) seen.add(k) && out.push(p);
  };
  const variants = searchVariants(names, t2s)
    .slice(0, 4)
    .map((v) => ({ title: searchText(v.title), artist: searchText(v.artist) }));
  for (const v of variants) add({ track_name: v.title, artist_name: v.artist });
  for (const v of variants) add({ q: `${v.title} ${v.artist}` });
  // The artist may be spelled differently on LRCLIB (sodagreen vs 苏打绿): the title alone,
  // still matched on title and length.
  for (const v of variants) add({ track_name: v.title });
  return out;
}

/**
 * Lyrics for a song that isn't in the catalogue (Follow along): search LRCLIB
 * with each title/artist spelling and take a record with the same title,
 * within 8 seconds of the song's length. Returns the record's id too.
 * One failing search doesn't stop the others; it only throws when every search
 * failed (so "not found" and "LRCLIB is down" are told apart).
 */
export async function searchLyrics(
  names: NameVariant[],
  durationS: number,
  t2s: Record<string, string>,
  retry: Parameters<typeof withRetry>[1] = { tries: 2 },
): Promise<{ id: number; lyrics: Lyrics } | null> {
  const song = { duration: durationS, names };
  let answered = 0;
  let lastError: unknown = null;
  for (const params of lyricSearches(names, t2s)) {
    let found: LrcRecord[];
    try {
      found = (await withRetry(() => getJson<LrcRecord[]>(`${BASE}/search?${new URLSearchParams(params)}`), retry)) ?? [];
      answered++;
    } catch (e) {
      lastError = e;
      continue;
    }
    const best = pickLrcMatch(found, song, t2s);
    const lyrics = best && lyricsOf(best);
    if (best && lyrics) {
      byId.set(best.id, Promise.resolve(lyrics));
      return { id: best.id, lyrics };
    }
  }
  if (!answered && lastError) throw lastError;
  return null;
}
