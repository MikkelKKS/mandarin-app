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

/**
 * Lyrics for a song that isn't in the catalogue (Follow along): search LRCLIB
 * with each title/artist spelling and take a record with the same title,
 * within 8 seconds of the song's length. Returns the record's id too.
 */
export async function searchLyrics(names: NameVariant[], durationS: number, t2s: Record<string, string>): Promise<{ id: number; lyrics: Lyrics } | null> {
  const song = { duration: durationS, names };
  for (const v of searchVariants(names, t2s).slice(0, 4)) {
    const searches: Array<Record<string, string>> = [{ track_name: v.title, artist_name: v.artist }, { q: `${v.title} ${v.artist}` }];
    for (const params of searches) {
      const found = (await withRetry(() => getJson<LrcRecord[]>(`${BASE}/search?${new URLSearchParams(params)}`), { tries: 3 })) ?? [];
      const best = pickLrcMatch(found, song, t2s);
      const lyrics = best && lyricsOf(best);
      if (best && lyrics) {
        byId.set(best.id, Promise.resolve(lyrics));
        return { id: best.id, lyrics };
      }
    }
  }
  return null;
}
