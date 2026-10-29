/** The app's Spotify playlist, "学中文: songs at my level", filled from the top of the current list. */
import { loadVocab } from '../../lib/vocabData';
import { hanziKnowledge, loadWordStates } from '../../lib/knowledge';
import type { RankedSong } from './catalogue';
import type { Knowledge } from './score';
import { createPlaylist, setPlaylistItems } from './spotify';
import { findOnSpotify } from './spotifyIds';

const K_PLAYLIST = 'music:playlist';
export const PLAYLIST_SIZE = 40;

export async function loadKnowledge(level: number): Promise<Knowledge> {
  const [vocab, states] = await Promise.all([loadVocab(), loadWordStates()]);
  return { ...hanziKnowledge(vocab, states), level };
}

let t2sPromise: Promise<Record<string, string>> | null = null;
export function loadT2s(): Promise<Record<string, string>> {
  t2sPromise ??= fetch(`${import.meta.env.BASE_URL}dict/t2s.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return t2sPromise;
}

/**
 * Find the top songs on Spotify (remembered per song), then create the
 * playlist the first time and replace its songs after that.
 */
export async function savePlaylist(songs: RankedSong[], level: number, onProgress: (done: number, total: number) => void): Promise<{ url: string; found: number; missing: number }> {
  const t2s = await loadT2s();
  const uris: string[] = [];
  let missing = 0;
  const top = songs.slice(0, PLAYLIST_SIZE + 20);
  for (const [i, r] of top.entries()) {
    if (uris.length >= PLAYLIST_SIZE) break;
    const t = await findOnSpotify(r.song, t2s).catch(() => null);
    if (t) uris.push(t.uri);
    else missing++;
    onProgress(i + 1, Math.min(top.length, PLAYLIST_SIZE + missing));
  }
  let saved: { id: string; url: string } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(K_PLAYLIST) ?? 'null');
  } catch {
    saved = null;
  }
  const levelText = level >= 7 ? 'HSK 7–9' : `HSK ${level}`;
  if (saved) {
    try {
      await setPlaylistItems(saved.id, uris);
      return { url: saved.url, found: uris.length, missing };
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
  return { url: created.url, found: uris.length, missing };
}
