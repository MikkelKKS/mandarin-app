/**
 * The song catalogue (content/data/songs.json, built weekly by scripts/build-songs.ts):
 * Mandarin songs that have lyrics on LRCLIB, with derived data only (which HSK
 * words occur and how often, a level profile). Lyrics themselves are never stored.
 * Ranking against what you know is instant and works offline.
 */
import songsUrl from '../../../content/data/songs.json?url';
import type { NameVariant } from './match';

export interface CatalogueSong {
  /** LRCLIB id (lyrics are fetched with it when the song is opened). */
  id: number;
  title: string;
  artist: string;
  /** Seconds. */
  dur: number;
  /** Timed lyrics exist (for Follow along). */
  synced: boolean;
  scene: string;
  /** Other spellings seen on LRCLIB or MusicBrainz (traditional, romanised), for finding it on Spotify. */
  alt?: Array<[string, string]>;
  /** HSK words: "index:count,…" into the catalogue's word list. */
  w: string;
  /** Han-character word tokens that aren't HSK words (names, rare words). */
  o: number;
  /** Filler tokens (啊, 呀, 哦…): counted as known. */
  f: number;
  /** Distinct words, HSK or not. */
  d: number;
  /** Distinct HSK words per level 1–7 (7 = HSK 7–9). */
  lv: number[];
}

export interface Catalogue {
  generated: string;
  words: string[];
  songs: CatalogueSong[];
}

export type Band = 'comfortable' | 'stretch' | 'tough';
/** Share of the words (each time they're sung) you know: comfortable 95%+, stretch 85–95%, tough below. */
export const BANDS = { comfortable: 0.95, stretch: 0.85 };
export const bandOf = (share: number): Band => (share >= BANDS.comfortable ? 'comfortable' : share >= BANDS.stretch ? 'stretch' : 'tough');

export function decodeWords(c: Catalogue, s: CatalogueSong): Array<{ id: string; n: number }> {
  if (!s.w) return [];
  return s.w.split(',').map((x) => {
    const [i, n] = x.split(':');
    return { id: c.words[Number(i)], n: Number(n) || 1 };
  });
}

export interface SongScore {
  /** Share of word tokens you know or are learning (fillers count as known). */
  knownShare: number;
  band: Band;
  /** HSK words you don't know yet, most sung first. */
  unknown: string[];
  tokens: number;
}

/**
 * Score a song against what you know. `known(id)` is true for words you know
 * or are learning; `order(id)` breaks ties (more common words first).
 */
export function scoreSong(c: Catalogue, s: CatalogueSong, known: (id: string) => boolean, order: (id: string) => number = () => 0): SongScore {
  const ws = decodeWords(c, s);
  let ok = s.f;
  let total = s.f + s.o;
  const unknown: Array<{ id: string; n: number }> = [];
  for (const w of ws) {
    total += w.n;
    if (known(w.id)) ok += w.n;
    else unknown.push(w);
  }
  unknown.sort((a, b) => b.n - a.n || order(a.id) - order(b.id));
  const knownShare = total ? ok / total : 0;
  return { knownShare, band: bandOf(knownShare), unknown: unknown.slice(0, 12).map((u) => u.id), tokens: total };
}

export interface Filters {
  /** Scenes to include (empty = all). */
  scenes: string[];
  band: Band | 'any';
  syncedOnly: boolean;
}

export interface RankedSong {
  song: CatalogueSong;
  score: SongScore;
}

/** Filter, then easiest first, at most 3 songs per artist before the rest. */
export function rankSongs(c: Catalogue, f: Filters, known: (id: string) => boolean, order?: (id: string) => number): RankedSong[] {
  const scored = c.songs
    .filter((s) => (!f.scenes.length || f.scenes.includes(s.scene)) && (!f.syncedOnly || s.synced))
    .map((song) => ({ song, score: scoreSong(c, song, known, order) }))
    .filter((r) => f.band === 'any' || r.score.band === f.band)
    .sort((a, b) => b.score.knownShare - a.score.knownShare || b.score.tokens - a.score.tokens);
  const per = new Map<string, number>();
  const first: RankedSong[] = [];
  const later: RankedSong[] = [];
  for (const r of scored) {
    const n = per.get(r.song.artist) ?? 0;
    per.set(r.song.artist, n + 1);
    (n < 3 ? first : later).push(r);
  }
  return [...first, ...later];
}

/** Every spelling of a song worth trying on Spotify (stored first, then the alternatives). */
export function namesOf(s: CatalogueSong): NameVariant[] {
  return [{ title: s.title, artist: s.artist }, ...(s.alt ?? []).map(([title, artist]) => ({ title, artist }))];
}

let cache: Promise<Catalogue> | null = null;
/** The catalogue is a plain file (cached by the service worker), fetched on first use. */
export function loadCatalogue(): Promise<Catalogue> {
  cache ??= fetch(songsUrl)
    .then((r) => (r.ok ? (r.json() as Promise<Catalogue>) : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}
