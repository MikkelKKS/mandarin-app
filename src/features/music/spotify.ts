/**
 * Spotify Web API from the browser, using the PKCE login flow (no client
 * secret, no server). Tokens stay in this browser's localStorage.
 * The owner registers a free Spotify app and gives the app its Client ID.
 */

const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
// user-read-private is needed for market=from_token (songs playable in your country).
const SCOPES = ['user-read-private', 'user-top-read', 'playlist-read-private', 'playlist-modify-private', 'playlist-modify-public', 'user-read-currently-playing'];

const K_CLIENT = 'spotify:clientId';
const K_AUTH = 'spotify:auth';
const K_PENDING = 'spotify:pending';

export interface Track {
  id: string;
  name: string;
  artists: string[];
  durationMs: number;
  uri: string;
  url: string;
  image?: string;
}

interface Auth {
  access: string;
  refresh: string;
  expiresAt: number;
  scope?: string;
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function clientId(): string {
  return (get(K_CLIENT) || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();
}
export function setClientId(id: string): void {
  set(K_CLIENT, id.trim() || null);
}

/** Must match a Redirect URI registered in the Spotify app exactly. */
export function redirectUri(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

function auth(): Auth | null {
  try {
    const a = JSON.parse(get(K_AUTH) ?? 'null') as Auth | null;
    // A login from an older version lacks scopes we now need: log in again.
    if (a && !SCOPES.every((sc) => (a.scope ?? '').split(' ').includes(sc))) {
      set(K_AUTH, null);
      return null;
    }
    return a;
  } catch {
    return null;
  }
}
export function isConnected(): boolean {
  return !!auth();
}
export function disconnect(): void {
  set(K_AUTH, null);
}

function randomString(n: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}
async function challenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Send the user to Spotify to log in. They come back via callback.ts. */
export async function login(): Promise<void> {
  const verifier = randomString(64);
  const state = `sp-${randomString(16)}`;
  set(K_PENDING, JSON.stringify({ verifier, state }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
    state,
  });
  location.assign(`${AUTH}?${q}`);
}

async function tokenRequest(body: Record<string, string>): Promise<Auth> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `Spotify login failed (${res.status})`);
  const prev = rawAuth();
  const a: Auth = {
    access: j.access_token,
    refresh: j.refresh_token ?? prev?.refresh ?? '',
    expiresAt: Date.now() + (j.expires_in - 60) * 1000,
    scope: j.scope ?? prev?.scope ?? '',
  };
  set(K_AUTH, JSON.stringify(a));
  return a;
}

/** Finish a login if we just came back from Spotify. Returns an error message, if any. */
export async function finishLogin(): Promise<string | null> {
  let cb: { code: string | null; error: string | null; state: string } | null = null;
  try {
    cb = JSON.parse(sessionStorage.getItem('spotify:callback') ?? 'null');
    sessionStorage.removeItem('spotify:callback');
  } catch {
    return null;
  }
  if (!cb) return null;
  if (cb.error) return cb.error === 'access_denied' ? 'Spotify login was cancelled.' : `Spotify said: ${cb.error}`;
  const pending = JSON.parse(get(K_PENDING) ?? 'null') as { verifier: string; state: string } | null;
  set(K_PENDING, null);
  if (!pending || pending.state !== cb.state || !cb.code) return 'The Spotify login expired. Please try again.';
  try {
    await tokenRequest({ grant_type: 'authorization_code', code: cb.code, redirect_uri: redirectUri(), code_verifier: pending.verifier });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function rawAuth(): Auth | null {
  try {
    return JSON.parse(get(K_AUTH) ?? 'null') as Auth | null;
  } catch {
    return null;
  }
}

let refreshing: Promise<Auth> | null = null;
async function accessToken(): Promise<string> {
  const a = auth();
  if (!a) throw new Error('Not connected to Spotify.');
  if (Date.now() < a.expiresAt) return a.access;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: a.refresh }).finally(() => (refreshing = null));
  try {
    return (await refreshing).access;
  } catch (e) {
    disconnect();
    throw e;
  }
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T | null> {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry) {
    const a = auth();
    if (a) set(K_AUTH, JSON.stringify({ ...a, expiresAt: 0 }));
    return api(path, init, false);
  }
  if (res.status === 429 && retry) {
    const wait = Math.min(10, Number(res.headers.get('Retry-After')) || 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return api(path, init, false);
  }
  if (res.status === 204) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    let msg = j?.error?.message || `Spotify error ${res.status}`;
    if (/insufficient client scope/i.test(msg)) {
      disconnect();
      msg = 'Spotify needs you to connect again (the app asks for one more permission). Tap Connect Spotify.';
    } else if (/not registered|user may not be/i.test(msg)) msg = `${msg}. Add your Spotify account under User Management in the Spotify developer dashboard.`;
    throw new SpotifyError(msg, res.status);
  }
  return j as T;
}

interface ApiTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  album?: { images?: Array<{ url: string; width: number }> };
  external_urls?: { spotify?: string };
  is_local?: boolean;
}
function toTrack(t: ApiTrack): Track {
  const imgs = t.album?.images ?? [];
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    durationMs: t.duration_ms,
    uri: t.uri,
    url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    image: (imgs.find((i) => i.width <= 300) ?? imgs[imgs.length - 1])?.url,
  };
}

export async function me(): Promise<{ id: string; name: string; product?: string }> {
  const j = await api<{ id: string; display_name?: string; product?: string }>('/me');
  return { id: j!.id, name: j!.display_name ?? j!.id, product: j!.product };
}

export async function topArtists(): Promise<Array<{ name: string; genres: string[] }>> {
  const j = await api<{ items: Array<{ name: string; genres?: string[] }> }>('/me/top/artists?limit=30&time_range=medium_term');
  return (j?.items ?? []).map((a) => ({ name: a.name, genres: a.genres ?? [] }));
}

/** Track search. Development-mode apps get at most 10 results per page. */
export async function searchTracks(q: string, offset = 0): Promise<Track[]> {
  const params = new URLSearchParams({ q, type: 'track', limit: '10', offset: String(offset), market: 'from_token' });
  const j = await api<{ tracks?: { items: Array<ApiTrack | null> } }>(`/search?${params}`);
  return (j?.tracks?.items ?? []).filter((t): t is ApiTrack => !!t && !t.is_local).map(toTrack);
}

export async function track(id: string): Promise<Track> {
  return toTrack((await api<ApiTrack>(`/tracks/${id}?market=from_token`))!);
}

export async function createPlaylist(name: string, description: string): Promise<{ id: string; url: string }> {
  const j = await api<{ id: string; external_urls: { spotify: string } }>('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
  });
  return { id: j!.id, url: j!.external_urls.spotify };
}

/** Replace a playlist's songs (up to 100). */
export async function setPlaylistItems(playlistId: string, uris: string[]): Promise<void> {
  const body = JSON.stringify({ uris: uris.slice(0, 100) });
  try {
    await api(`/playlists/${playlistId}/items`, { method: 'PUT', body });
  } catch (e) {
    // Older name of the same endpoint.
    if (e instanceof SpotifyError && e.status === 404) await api(`/playlists/${playlistId}/tracks`, { method: 'PUT', body });
    else throw e;
  }
}

export interface NowPlaying {
  track: Track;
  progressMs: number;
  playing: boolean;
  at: number;
}
export async function currentlyPlaying(): Promise<NowPlaying | null> {
  const j = await api<{ item: ApiTrack | null; progress_ms: number; is_playing: boolean; currently_playing_type: string }>('/me/player/currently-playing?market=from_token');
  if (!j?.item || j.currently_playing_type !== 'track') return null;
  return { track: toTrack(j.item), progressMs: j.progress_ms, playing: j.is_playing, at: Date.now() };
}
