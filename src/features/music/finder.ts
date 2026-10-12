/** Find Mandarin songs on Spotify and rank them by how well you'd understand the lyrics. */
import { words } from '../../content';
import { db } from '../../db/db';
import { isKnown } from '../../lib/stats';
import type { Dict } from '../dictionary/dict';
import { sceneById } from './genres';
import { cleanTitle, fetchLyrics } from './lyrics';
import { isChineseLyrics, scoreLyrics, type Knowledge, type SongScore } from './score';
import { createPlaylist, searchTracks, setPlaylistItems, type Track } from './spotify';

export interface ScoredSong {
  track: Track;
  score: SongScore;
  scene: string;
}

export async function loadKnowledge(level: number): Promise<Knowledge> {
  const items = await db.reviewItems.toArray();
  const known = new Set<string>();
  const learning = new Set<string>();
  for (const r of items) {
    const w = words.get(r.id);
    if (!w) continue;
    (isKnown(r) ? known : learning).add(w.hanzi);
  }
  for (const h of known) learning.delete(h);
  return { known, learning, level };
}

let t2sPromise: Promise<Record<string, string>> | null = null;
export function loadT2s(): Promise<Record<string, string>> {
  t2sPromise ??= fetch(`${import.meta.env.BASE_URL}dict/t2s.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return t2sPromise;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Search Spotify for candidate songs from the chosen scenes. */
async function candidates(sceneIds: string[], extraArtists: string[], max: number): Promise<Array<{ track: Track; scene: string }>> {
  const searches: Array<{ q: string; scene: string; offset: number }> = [];
  for (const a of extraArtists.slice(0, 4)) searches.push({ q: `artist:"${a}"`, scene: 'yours', offset: 0 });
  for (const id of sceneIds) {
    const s = sceneById(id);
    if (!s) continue;
    for (const a of shuffle(s.artists).slice(0, 4)) searches.push({ q: `artist:"${a}"`, scene: id, offset: 0 });
    for (const q of s.queries ?? []) searches.push({ q, scene: id, offset: Math.floor(Math.random() * 3) * 10 });
    if (s.spotifyGenres[0]) searches.push({ q: `genre:"${s.spotifyGenres[0]}"`, scene: id, offset: Math.floor(Math.random() * 4) * 10 });
  }
  const seen = new Set<string>();
  const out: Array<{ track: Track; scene: string }> = [];
  for (const s of shuffle(searches)) {
    if (out.length >= max) break;
    let found: Track[] = [];
    try {
      found = await searchTracks(s.q, s.offset);
    } catch (e) {
      if (out.length === 0 && searches.indexOf(s) === searches.length - 1) throw e;
      continue;
    }
    for (const t of found) {
      const key = `${cleanTitle(t.name)}|${t.artists[0]}`;
      if (seen.has(t.id) || seen.has(key)) continue;
      seen.add(t.id);
      seen.add(key);
      out.push({ track: t, scene: s.scene });
    }
  }
  return out.slice(0, max);
}

export async function findSongs(opts: {
  scenes: string[];
  extraArtists: string[];
  knowledge: Knowledge;
  dict: Dict;
  onProgress: (done: number, total: number, found: number) => void;
  max?: number;
}): Promise<ScoredSong[]> {
  const t2s = await loadT2s();
  const cands = await candidates(opts.scenes, opts.extraArtists, opts.max ?? 60);
  const results: ScoredSong[] = [];
  let done = 0;
  let failures = 0;
  opts.onProgress(0, cands.length, 0);
  const queue = [...cands];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const lyrics = await fetchLyrics(c.track);
        const lines = lyrics?.lines.map((l) => l.text).filter(Boolean) ?? [];
        if (lines.length && isChineseLyrics(lines)) {
          const score = scoreLyrics(lines, opts.dict, t2s, opts.knowledge);
          if (!score.cantonese && score.total >= 30) results.push({ track: c.track, score, scene: c.scene });
        }
      } catch {
        failures++;
      }
      opts.onProgress(++done, cands.length, results.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (!results.length && failures === cands.length && cands.length) throw new Error("Couldn't reach the lyrics service. Check your connection and try again.");
  return rank(results);
}

/** Easiest first, at most 3 songs per artist near the top. */
export function rank(songs: ScoredSong[]): ScoredSong[] {
  const sorted = [...songs].sort((a, b) => b.score.fit - a.score.fit || b.score.knownShare - a.score.knownShare);
  const perArtist = new Map<string, number>();
  const first: ScoredSong[] = [];
  const later: ScoredSong[] = [];
  for (const s of sorted) {
    const a = s.track.artists[0];
    const n = perArtist.get(a) ?? 0;
    perArtist.set(a, n + 1);
    (n < 3 ? first : later).push(s);
  }
  return [...first, ...later];
}

const K_RESULTS = 'music:results:v1';
const K_PLAYLIST = 'music:playlist';

export interface SavedResults {
  at: number;
  level: number;
  scenes: string[];
  songs: ScoredSong[];
}
export function loadResults(): SavedResults | null {
  try {
    return JSON.parse(localStorage.getItem(K_RESULTS) ?? 'null');
  } catch {
    return null;
  }
}
export function saveResults(r: SavedResults): void {
  try {
    localStorage.setItem(K_RESULTS, JSON.stringify(r));
  } catch {
    // ignore
  }
}

/** Create the app's playlist the first time, then keep replacing its songs. */
export async function savePlaylist(songs: ScoredSong[], level: number): Promise<string> {
  let saved: { id: string; url: string } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(K_PLAYLIST) ?? 'null');
  } catch {
    saved = null;
  }
  const uris = songs.slice(0, 40).map((s) => s.track.uri);
  const levelText = level > 3 ? 'HSK 3+' : `HSK ${level}`;
  if (saved) {
    try {
      await setPlaylistItems(saved.id, uris);
      return saved.url;
    } catch {
      // deleted on Spotify's side: make a new one
    }
  }
  const created = await createPlaylist('学中文: songs at my level', `Mandarin songs picked for ${levelText}, easiest first. Made by my Mandarin app.`);
  await setPlaylistItems(created.id, uris);
  try {
    localStorage.setItem(K_PLAYLIST, JSON.stringify(created));
  } catch {
    // ignore
  }
  return created.url;
}
