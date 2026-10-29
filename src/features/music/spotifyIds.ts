/**
 * Which Spotify track a catalogue song is, looked up only when a song is opened
 * or played, and remembered (in the synced settings table, so phone and PC share it).
 */
import type { Table } from 'dexie';
import { db } from '../../db/db';
import { namesOf, type CatalogueSong } from './catalogue';
import { pickSpotifyMatch, searchVariants } from './match';
import { searchTracks, type Track } from './spotify';

interface Row {
  id: 'music-spotify';
  /** LRCLIB id → Spotify track (null: not found, with when we last looked). */
  map: Record<string, { track: Pick<Track, 'id' | 'uri' | 'url' | 'image' | 'name' | 'artists' | 'durationMs'> | null; at: number }>;
  updatedAt: number;
}
const table = () => db.settings as unknown as Table<Row, string>;
const ROW = 'music-spotify' as const;
/** Look again for songs that weren't found after a week (Spotify adds songs). */
const RETRY_NOT_FOUND = 7 * 864e5;

export async function cachedTrack(songId: number): Promise<Row['map'][string] | undefined> {
  return (await table().get(ROW))?.map[String(songId)];
}

async function remember(songId: number, track: Row['map'][string]['track']): Promise<void> {
  const row = (await table().get(ROW)) ?? { id: ROW, map: {}, updatedAt: 0 };
  row.map[String(songId)] = { track, at: Date.now() };
  await table().put({ ...row, updatedAt: Date.now() });
}

/** Spotify track id → LRCLIB id, for Follow along. */
export async function songOfTrack(trackId: string): Promise<number | null> {
  const row = await table().get(ROW);
  for (const [song, v] of Object.entries(row?.map ?? {})) if (v.track?.id === trackId) return Number(song);
  return null;
}

/**
 * Find a song on Spotify: track search with title and artist in each stored
 * spelling, picking a result within 5 seconds of the song's length. Remembered.
 */
export async function findOnSpotify(s: CatalogueSong, t2s: Record<string, string>): Promise<Track | null> {
  const cached = await cachedTrack(s.id);
  if (cached && (cached.track || Date.now() - cached.at < RETRY_NOT_FOUND)) return (cached.track as Track) ?? null;
  const song = { duration: s.dur, names: namesOf(s) };
  for (const v of searchVariants(song.names, t2s).slice(0, 4)) {
    for (const q of [`track:${v.title} artist:${v.artist}`, `${v.title} ${v.artist}`]) {
      const best = pickSpotifyMatch(await searchTracks(q), song, t2s);
      if (best) {
        await remember(s.id, best);
        return best;
      }
    }
  }
  await remember(s.id, null);
  return null;
}
