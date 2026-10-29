/**
 * Music: Mandarin songs from the song catalogue (lyrics on LRCLIB), ranked
 * instantly by how much of the lyrics you'd understand. Spotify is only used
 * to play a song, save the playlist and Follow along.
 */
import { PageHeader } from '../../components/PageHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WordPopover } from '../../components/WordPopover';
import { Music } from '../../components/icons';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { usePinyinFn } from '../../lib/pinyinPro';
import { loadDict, type Dict } from '../dictionary/dict';
import { translateIfSetUp } from '../dictionary/translate';
import { currentLevel, isKnownState, isStartedState, useWordStates } from '../../lib/knowledge';
import { useVocab, type VocabRow } from '../../lib/vocabData';
import { loadCatalogue, namesOf, rankSongs, scoreSong, type Band, type Catalogue, type CatalogueSong, type Filters, type RankedSong, type SongScore } from './catalogue';
import { SCENES } from './genres';
import { lyricsById, searchLyrics, type Lyrics } from './lyrics';
import { pickLrcMatch, sameName } from './match';
import { loadKnowledge, loadT2s, PLAYLIST_SIZE, savePlaylist } from './playlist';
import { tokenize, type Knowledge, type LyricToken } from './score';
import * as sp from './spotify';
import { findOnSpotify, songOfTrack } from './spotifyIds';

const K_FILTERS = 'music:filters:v2';

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // ignore
  }
}

const BAND: Record<Band, { label: string; cls: string; blurb: string }> = {
  comfortable: { label: 'Comfortable', cls: 'bg-jade-soft text-jade', blurb: '95%+ of the words known' },
  stretch: { label: 'Stretch', cls: 'bg-amber-soft text-gold', blurb: '85–95% known' },
  tough: { label: 'Tough', cls: 'bg-cinnabar-soft text-cinnabar', blurb: 'under 85% known' },
};

export function MusicRoute({ route }: { route: string[] }) {
  if (route[1] === 'song' && route[2]) return <SongView id={Number(route[2])} />;
  if (route[1] === 'now') return <NowPlaying />;
  return <MusicView />;
}

function levelLabel(level: number): string {
  return level >= 7 ? 'HSK 7–9' : `HSK ${level}`;
}

/** The HSK level you're working on, from the same word knowledge as everywhere else. */
function useLevel(): number | undefined {
  const vocab = useVocab();
  const states = useWordStates();
  return vocab && states ? currentLevel(vocab, states) : undefined;
}

function useCatalogue(): Catalogue | null | 'error' {
  const [c, setC] = useState<Catalogue | null | 'error'>(null);
  useEffect(() => {
    let live = true;
    loadCatalogue()
      .then((x) => live && setC(x))
      .catch(() => live && setC('error'));
    return () => {
      live = false;
    };
  }, []);
  return c;
}

/** Known or learning (you've met it), by HSK word id; and frequency order for ties. */
function useKnown(): { known: (id: string) => boolean; order: (id: string) => number; byId: Map<string, VocabRow> } | null {
  const vocab = useVocab();
  const states = useWordStates();
  return useMemo(() => {
    if (!vocab || !states) return null;
    const byId = new Map(vocab.map((w) => [w.id, w]));
    return {
      known: (id: string) => {
        const s = states.get(id);
        return isKnownState(s) || isStartedState(s);
      },
      order: (id: string) => byId.get(id)?.order ?? 1e9,
      byId,
    };
  }, [vocab, states]);
}

export function MusicView() {
  const level = useLevel() ?? 1;
  const cat = useCatalogue();
  const k = useKnown();
  const [filters, setFilters] = useState<Filters>(() => readJson<Filters>(K_FILTERS, { scenes: [], band: 'any', syncedOnly: false }));
  const [shown, setShown] = useState(40);
  const [connected, setConnected] = useState(sp.isConnected());
  const [error, setError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<{ busy: boolean; done?: number; total?: number; url?: string; found?: number; missing?: number }>({ busy: false });

  useEffect(() => {
    void sp.finishLogin().then((err) => {
      if (err) setError(err);
      setConnected(sp.isConnected());
    });
  }, []);

  const update = (f: Partial<Filters>) => {
    const next = { ...filters, ...f };
    setFilters(next);
    writeJson(K_FILTERS, next);
    setShown(40);
  };
  const toggleScene = (id: string) => update({ scenes: filters.scenes.includes(id) ? filters.scenes.filter((s) => s !== id) : [...filters.scenes, id] });

  const all = useMemo(() => (cat && cat !== 'error' && k ? rankSongs(cat, { ...filters, band: 'any' }, k.known, k.order) : null), [cat, k, filters]);
  const ranked = useMemo(() => (all ? (filters.band === 'any' ? all : all.filter((r) => r.score.band === filters.band)) : null), [all, filters.band]);
  const counts = useMemo(() => {
    const c = { comfortable: 0, stretch: 0, tough: 0 };
    for (const r of all ?? []) c[r.score.band]++;
    return c;
  }, [all]);

  const save = async () => {
    if (!ranked) return;
    setError(null);
    setPlaylist({ busy: true, done: 0, total: Math.min(PLAYLIST_SIZE, ranked.length) });
    try {
      const r = await savePlaylist(ranked, level, (done, total) => setPlaylist((p) => ({ ...p, done, total })));
      setPlaylist({ busy: false, ...r });
    } catch (e) {
      setError(`Spotify wouldn't save the playlist (${(e as Error).message}).`);
      setPlaylist({ busy: false });
      setConnected(sp.isConnected());
    }
  };

  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Library', to: 'library' }} title="Music">
        Mandarin songs with lyrics, sorted by how much you'd understand at {levelLabel(level)}. Open one for its lyrics with pinyin.
      </PageHeader>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-cinnabar-soft p-4 text-sm text-cinnabar">
          {error}
        </p>
      )}

      <section className="mt-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Scenes">
          {SCENES.map((s) => {
            const on = filters.scenes.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleScene(s.id)}
                aria-pressed={on}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${on ? 'border-jade bg-jade-soft text-jade' : 'border-line bg-surface'}`}
              >
                <span className="han mr-1.5" lang="zh-CN">
                  {s.hanzi}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">{filters.scenes.length ? 'Showing the scenes you picked.' : 'All scenes. Tap some to narrow it down.'}</p>
        <div className="mt-4 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Difficulty">
          {(['any', 'comfortable', 'stretch', 'tough'] as const).map((b) => (
            <button
              key={b}
              role="radio"
              aria-checked={filters.band === b}
              onClick={() => update({ band: b })}
              className={`rounded-xl border px-1 py-2 text-sm font-medium ${filters.band === b ? 'border-jade bg-jade text-jade-ink' : 'border-line bg-surface'}`}
            >
              {b === 'any' ? 'All' : BAND[b].label}
              {b !== 'any' && all && <span className="block text-[11px] font-normal opacity-80 tabular-nums">{counts[b]}</span>}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.syncedOnly} onChange={(e) => update({ syncedOnly: e.target.checked })} className="h-4 w-4 accent-[var(--jade)]" />
          Only songs with timed lyrics (for Follow along)
        </label>
      </section>

      {cat === 'error' ? (
        <p className="mt-6 rounded-2xl bg-sunk p-4 text-muted">The song list couldn't load. Check your connection and open Music again.</p>
      ) : !ranked ? (
        <p className="mt-6 text-muted">Loading songs…</p>
      ) : cat && cat.songs.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-sunk p-4 text-muted">The song list is being built. It's ready after the next update.</p>
      ) : (
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{ranked.length.toLocaleString('en-GB')} songs</h2>
            {filters.band !== 'any' && <span className="text-sm text-muted">{BAND[filters.band].blurb}</span>}
          </div>
          <SpotifyBar connected={connected} playlist={playlist} onSave={() => void save()} disabled={!ranked.length} />
          <ul className="mt-4 flex flex-col gap-2">
            {ranked.slice(0, shown).map((r) => (
              <SongRow key={r.song.id} r={r} byId={k!.byId} />
            ))}
          </ul>
          {ranked.length > shown && (
            <button onClick={() => setShown(shown + 40)} className="mt-3 h-12 w-full rounded-2xl border border-line font-medium">
              Show more
            </button>
          )}
        </section>
      )}

      <p className="mt-10 text-xs text-muted">
        Lyrics come from{' '}
        <a className="underline" href="https://lrclib.net" target="_blank" rel="noreferrer">
          LRCLIB
        </a>{' '}
        and are read on your device only; the song list was built from MusicBrainz and LRCLIB{cat && cat !== 'error' && cat.generated ? ` (updated ${cat.generated})` : ''}.
        {connected && (
          <>
            {' '}
            <button
              className="underline"
              onClick={() => {
                sp.disconnect();
                setConnected(false);
              }}
            >
              Disconnect Spotify
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function SpotifyBar({ connected, playlist, onSave, disabled }: { connected: boolean; playlist: { busy: boolean; done?: number; total?: number; url?: string; found?: number; missing?: number }; onSave: () => void; disabled: boolean }) {
  if (!sp.clientId()) return null;
  if (!connected)
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <Music className="h-6 w-6 shrink-0 text-jade" />
        <p className="min-w-0 flex-1 text-sm text-muted">Connect Spotify to play songs, save a playlist and follow along.</p>
        <button onClick={() => void sp.login()} className="h-10 shrink-0 rounded-full bg-jade px-4 text-sm font-semibold text-jade-ink">
          Connect
        </button>
      </div>
    );
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button onClick={onSave} disabled={playlist.busy || disabled} className="h-12 flex-1 rounded-2xl bg-jade font-semibold text-jade-ink disabled:opacity-60">
          {playlist.busy ? `Finding them on Spotify… ${playlist.done ?? 0}/${playlist.total ?? PLAYLIST_SIZE}` : playlist.url ? 'Playlist saved' : `Save the top ${PLAYLIST_SIZE} as a playlist`}
        </button>
        <button onClick={() => go('music/now')} className="h-12 rounded-2xl border border-line px-4 font-medium">
          Follow along
        </button>
      </div>
      {playlist.url && (
        <p className="mt-2 text-center text-sm">
          <a href={playlist.url} target="_blank" rel="noreferrer" className="font-medium text-jade underline">
            Open “学中文: songs at my level” in Spotify
          </a>
          {playlist.missing ? <span className="text-muted"> · {playlist.missing} weren't on Spotify, so they were skipped</span> : null}
        </p>
      )}
    </div>
  );
}

function SongRow({ r, byId }: { r: RankedSong; byId: Map<string, VocabRow> }) {
  const b = BAND[r.score.band];
  return (
    <li>
      <button onClick={() => go(`music/song/${r.song.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition duration-150 hover:bg-sunk active:scale-[0.99]">
        <span className="min-w-0 flex-1">
          <span className="han block truncate font-semibold">{r.song.title}</span>
          <span className="han block truncate text-sm text-muted">{r.song.artist}</span>
          {r.score.unknown.length > 0 && (
            <span className="mt-1 block truncate text-xs text-muted">
              New:{' '}
              <span className="han" lang="zh-CN">
                {r.score.unknown
                  .slice(0, 4)
                  .map((id) => byId.get(id)?.hanzi)
                  .filter(Boolean)
                  .join('、')}
              </span>
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>
          <span className="mt-0.5 block text-xs tabular-nums text-muted">you know {Math.floor(r.score.knownShare * 100)}%</span>
          {r.song.synced && <span className="block text-[11px] text-muted">timed lyrics</span>}
        </span>
      </button>
    </li>
  );
}

/** Dictionary, character map and what you know, for reading lyrics. */
function useReader(): { dict: Dict; t2s: Record<string, string>; k: Knowledge } | null | 'nodict' {
  const level = useLevel();
  const [r, setR] = useState<{ dict: Dict; t2s: Record<string, string>; k: Knowledge } | null | 'nodict'>(null);
  useEffect(() => {
    if (level === undefined) return;
    let live = true;
    void Promise.all([loadDict(), loadT2s(), loadKnowledge(level)]).then(([dict, t2s, k]) => live && setR(dict ? { dict, t2s, k } : 'nodict'));
    return () => {
      live = false;
    };
  }, [level]);
  return r;
}

type LyricsState = { kind: 'loading' } | { kind: 'ok'; lyrics: Lyrics } | { kind: 'none' } | { kind: 'error' };

/** Lyrics by LRCLIB id, with retries; "Try again" retries. */
function useLyrics(id: number | null): { state: LyricsState; retry: () => void } {
  const [state, setState] = useState<LyricsState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id === null) return;
    let live = true;
    setState({ kind: 'loading' });
    lyricsById(id)
      .then((l) => live && setState(l ? { kind: 'ok', lyrics: l } : { kind: 'none' }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [id, attempt]);
  return { state, retry: useCallback(() => setAttempt((a) => a + 1), []) };
}

function LyricsError({ retry, what = 'the lyrics' }: { retry: () => void; what?: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-sunk p-4">
      <p className="text-muted">Couldn't load {what}: the lyrics service didn't answer after a few tries. Check your connection.</p>
      <button onClick={retry} className="mt-3 h-11 rounded-full bg-jade px-5 font-semibold text-jade-ink">
        Try again
      </button>
    </div>
  );
}

type SpotifyState = { kind: 'off' } | { kind: 'looking' } | { kind: 'found'; track: sp.Track } | { kind: 'missing' } | { kind: 'error'; message: string };

function SongView({ id }: { id: number }) {
  const cat = useCatalogue();
  const k = useKnown();
  const song = cat && cat !== 'error' ? cat.songs.find((s) => s.id === id) : undefined;
  const score = useMemo(() => (cat && cat !== 'error' && song && k ? scoreSong(cat, song, k.known, k.order) : null), [cat, song, k]);
  const { state, retry } = useLyrics(id);
  const reader = useReader();
  const [showPy, setShowPy] = useState(true);
  const [word, setWord] = useState<OpenWord | null>(null);
  const [spot, setSpot] = useState<SpotifyState>({ kind: sp.isConnected() ? 'looking' : 'off' });

  useEffect(() => {
    if (!song || !sp.isConnected()) return;
    let live = true;
    void loadT2s()
      .then((t2s) => findOnSpotify(song, t2s))
      .then((t) => live && setSpot(t ? { kind: 'found', track: t } : { kind: 'missing' }))
      .catch((e) => live && setSpot({ kind: 'error', message: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [song]);

  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Music', to: 'music' }} title={song?.title ?? 'Song'} />
      {song && (
        <p className="han -mt-1 text-muted" lang="zh-CN">
          {song.artist}
        </p>
      )}
      {song && (
        <div className="mt-3">
          {spot.kind === 'found' ? (
            <a href={spot.track.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-jade px-4 text-sm font-semibold text-jade-ink">
              Play in Spotify
            </a>
          ) : spot.kind === 'looking' ? (
            <p className="text-sm text-muted">Looking for it on Spotify…</p>
          ) : spot.kind === 'missing' ? (
            <p className="text-sm text-muted">This song isn't on Spotify (or not under this name). The lyrics are below.</p>
          ) : spot.kind === 'error' ? (
            <p className="text-sm text-muted">Couldn't ask Spotify ({spot.message}). The lyrics are below.</p>
          ) : sp.clientId() ? (
            <button onClick={() => void sp.login()} className="text-sm font-medium text-jade underline">
              Connect Spotify to play it
            </button>
          ) : null}
        </div>
      )}
      {score && k && <Summary score={score} byId={k.byId} reader={reader} onWord={(token, anchor) => setWord({ token, anchor })} />}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lyrics</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPy} onChange={(e) => setShowPy(e.target.checked)} className="h-4 w-4 accent-[var(--jade)]" />
          Pinyin
        </label>
      </div>
      <Legend />
      {state.kind === 'error' ? (
        <LyricsError retry={retry} />
      ) : state.kind === 'loading' || !reader ? (
        <p className="mt-4 text-muted">Loading lyrics…</p>
      ) : reader === 'nodict' ? (
        <p className="mt-4 text-muted">The dictionary hasn't downloaded yet. Open the app with internet and try again.</p>
      ) : state.kind === 'none' ? (
        <p className="mt-4 text-muted">LRCLIB no longer has lyrics for this song.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {dedupe(state.lyrics.lines.map((l) => l.text)).map((line, i) =>
            line ? <LyricLine key={i} text={line} reader={reader} showPy={showPy} onWord={(token, anchor) => setWord({ token, anchor })} /> : <span key={i} className="h-2" />,
          )}
        </div>
      )}
      {word && <WordPopover text={word.token.text} entry={word.token.entry} known={word.token.status === 'known'} anchor={word.anchor} onClose={() => setWord(null)} />}
    </div>
  );
}

/** Drop consecutive duplicate blank lines. */
function dedupe(lines: string[]): string[] {
  return lines.filter((l, i) => l || (i > 0 && lines[i - 1]));
}

function Legend() {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        <span className="border-b-2 border-dotted border-jade">Underlined</span>: within your HSK level, not learned yet
      </span>
      <span>
        <span className="rounded bg-cinnabar-soft px-1">Shaded</span>: above your level
      </span>
    </p>
  );
}

function Summary({ score, byId, reader, onWord }: { score: SongScore; byId: Map<string, VocabRow>; reader: ReturnType<typeof useReader>; onWord: OnWord }) {
  const b = BAND[score.band];
  const entryOf = (h: string) => (reader && reader !== 'nodict' ? reader.dict.byHanzi.get(h)?.[0] : undefined);
  const words = score.unknown.map((id) => byId.get(id)).filter((w): w is VocabRow => !!w);
  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${b.cls}`}>{b.label}</span>
        <span className="text-sm text-muted">You know {Math.floor(score.knownShare * 100)}% of the words.</span>
      </div>
      {words.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium">Words to learn from this song</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {words.slice(0, 10).map((w) => (
              <button key={w.id} onClick={(ev) => onWord({ text: w.hanzi, entry: entryOf(w.hanzi), status: 'hard' }, ev.currentTarget.getBoundingClientRect())} className="han rounded-lg bg-sunk px-2 py-1 text-lg">
                {w.hanzi}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LyricLine({
  text,
  reader,
  showPy,
  onWord,
  big = false,
  alwaysPy = false,
  progress,
}: {
  text: string;
  reader: { dict: Dict; t2s: Record<string, string>; k: Knowledge };
  showPy: boolean;
  onWord: OnWord;
  big?: boolean;
  /** Ignore the "hover" setting: always show pinyin. */
  alwaysPy?: boolean;
  /** 0 to 1: how far through this line the song is (lights words up as they're sung). */
  progress?: number;
}) {
  const settings = useSettings();
  const py = usePinyinFn();
  const tokens = useMemo(() => tokenize(text, reader.dict, reader.t2s, reader.k), [text, reader]);
  // Pinyin per character for the whole line, so words like 了 and 的 get the right reading in context.
  const syllables = useMemo(() => (py ? py(tokens.map((t) => t.text).join('')) : null), [py, tokens]);
  const hover = settings.pinyinDisplay === 'hover' && !alwaysPy;
  const hanCount = tokens.reduce((n, t) => n + (t.status === 'other' ? 0 : [...t.text].length), 0);
  const sung = progress === undefined ? -1 : Math.floor(progress * hanCount + 0.5);
  let offset = 0;
  return (
    <p className={`han flex flex-wrap items-end gap-x-0.5 ${big ? 'text-3xl' : 'text-xl'}`} lang="zh-CN">
      {tokens.map((t, i) => {
        if (t.status === 'other')
          return (
            <span key={i} className="self-end">
              {t.text}
            </span>
          );
        const len = [...t.text].length;
        const start = offset;
        offset += len;
        const reading = syllables ? syllables.slice(start, start + len).join('') : (t.entry?.pinyin.replace(/ /g, '') ?? '');
        const lit = sung >= 0 && start < sung;
        return (
          <button
            key={i}
            onClick={(ev) => onWord(t, ev.currentTarget.getBoundingClientRect())}
            className={`group inline-flex flex-col items-center rounded px-0.5 leading-none transition-colors duration-300 ${t.status === 'hard' ? 'bg-cinnabar-soft/70' : ''} hover:bg-sunk`}
          >
            {showPy && (
              <span className={`mb-1 font-sans text-[0.45em] leading-none transition-colors duration-300 ${lit ? 'text-jade' : 'text-muted'} ${hover ? 'invisible group-hover:visible' : ''}`}>
                {reading || ' '}
              </span>
            )}
            <span className={`${t.status === 'level' ? 'border-b-2 border-dotted border-jade' : ''} ${lit ? 'text-jade' : ''}`}>{t.text}</span>
          </button>
        );
      })}
    </p>
  );
}

type OnWord = (t: LyricToken, anchor: DOMRect) => void;
interface OpenWord {
  token: LyricToken;
  anchor: DOMRect;
}

/** Timing nudge per Spotify track, on this device: lyrics running early or late. */
const K_NUDGE = 'music:nudge:';
function loadNudge(trackId: string): number {
  return readJson<number>(K_NUDGE + trackId, 0);
}

/** The catalogue song a playing track is: remembered Spotify match, else same title within 5 s. */
export function catalogueMatch(cat: Catalogue, track: Pick<sp.Track, 'name' | 'artists' | 'durationMs'>, t2s: Record<string, string>): CatalogueSong | null {
  const secs = track.durationMs / 1000;
  const recs = cat.songs
    .filter((s) => Math.abs(s.dur - secs) <= 5 && namesOf(s).some((n) => sameName(track.name, n.title, t2s)))
    .map((s) => ({ s, id: s.id, trackName: track.name, artistName: namesOf(s).some((n) => track.artists.some((a) => sameName(a, n.artist, t2s))) ? track.artists[0] : s.artist, duration: s.dur, instrumental: false, plainLyrics: s.synced ? null : 'x', syncedLyrics: s.synced ? 'x' : null }));
  const best = pickLrcMatch(recs, { duration: secs, names: [{ title: track.name, artist: track.artists[0] ?? '' }] }, t2s, 5);
  return best ? recs.find((r) => r.id === best.id)!.s : null;
}

type FollowLyrics = { kind: 'loading' } | { kind: 'ok'; lyrics: Lyrics; from: 'catalogue' | 'search' } | { kind: 'none' } | { kind: 'error' };

/** Shows the line being sung in whatever is playing on Spotify right now. */
function NowPlaying() {
  const [now, setNow] = useState<sp.NowPlaying | null | 'idle'>(null);
  const [lyrics, setLyrics] = useState<FollowLyrics>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reader = useReader();
  const cat = useCatalogue();
  const [word, setWord] = useState<OpenWord | null>(null);
  const trackId = now && now !== 'idle' ? now.track.id : null;
  const [nudge, setNudge] = useState(0);
  const [english, setEnglish] = useState<{ line: string; text: string | null } | null>(null);
  const current = useRef<HTMLDivElement>(null);

  // Ask Spotify what's playing every few seconds.
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const n = await sp.currentlyPlaying();
        if (live) setNow(n ?? 'idle');
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    void poll();
    const t = setInterval(poll, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  // Lyrics: the catalogue song's LRCLIB id if it's in the catalogue, else a live LRCLIB search.
  useEffect(() => {
    if (!trackId || now === null || now === 'idle' || cat === null) return;
    let live = true;
    setLyrics({ kind: 'loading' });
    setNudge(loadNudge(trackId));
    void (async () => {
      try {
        const t2s = await loadT2s();
        const known = (await songOfTrack(trackId)) ?? (cat !== 'error' ? catalogueMatch(cat, now.track, t2s)?.id : undefined);
        if (known) {
          const l = await lyricsById(known);
          if (l) return live && setLyrics({ kind: 'ok', lyrics: l, from: 'catalogue' });
        }
        const found = await searchLyrics(
          now.track.artists.map((a) => ({ title: now.track.name, artist: a })),
          now.track.durationMs / 1000,
          t2s,
        );
        if (live) setLyrics(found ? { kind: 'ok', lyrics: found.lyrics, from: 'search' } : { kind: 'none' });
      } catch {
        if (live) setLyrics({ kind: 'error' });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, cat, attempt]);
  // Smooth clock between polls.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const changeNudge = (d: number) => {
    if (!trackId) return;
    const v = Math.round((nudge + d) * 10) / 10;
    setNudge(v);
    writeJson(K_NUDGE + trackId, v);
  };

  const position = (now && now !== 'idle' ? now.progressMs + (now.playing ? Date.now() - now.at : 0) : 0) + nudge * 1000;
  const lines = lyrics.kind === 'ok' ? lyrics.lyrics.lines : [];
  const synced = lyrics.kind === 'ok' && lyrics.lyrics.synced;
  let idx = -1;
  if (synced) for (let i = 0; i < lines.length; i++) if ((lines[i].t ?? 0) <= position + 300) idx = i;
  // Lyrics are timed per line, not per word: spread the line's words evenly until the next line starts.
  let lineProgress = 0;
  if (idx >= 0) {
    const start = lines[idx].t ?? 0;
    const nextT = lines.slice(idx + 1).find((l) => l.t !== null && l.t > start)?.t ?? start + 4000;
    const span = Math.min(nextT - start, 8000) * 0.85; // singing usually ends a little before the next line
    lineProgress = Math.max(0, Math.min(1, (position - start) / span));
  }
  void tick;
  const line = idx >= 0 ? lines[idx].text : '';

  useEffect(() => {
    // Don't pull the page away while you're looking up a word.
    if (!word) current.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  // The English of the current line, when the app's translation function is set up (otherwise nothing).
  useEffect(() => {
    if (!line) return;
    const ctl = new AbortController();
    void translateIfSetUp(line, ctl.signal)
      .then((text) => setEnglish({ line, text }))
      .catch(() => {});
    return () => ctl.abort();
  }, [line]);

  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Music', to: 'music' }} title="Follow along" />
      {error && <p className="mt-3 rounded-2xl bg-cinnabar-soft p-4 text-sm text-cinnabar">{error}</p>}
      {!sp.isConnected() ? (
        <div className="mt-4 rounded-2xl bg-sunk p-4">
          <p className="text-muted">Follow along reads what's playing on your Spotify.</p>
          {sp.clientId() && (
            <button onClick={() => void sp.login()} className="mt-3 h-11 rounded-full bg-jade px-5 font-semibold text-jade-ink">
              Connect Spotify
            </button>
          )}
        </div>
      ) : now === null ? (
        <p className="mt-4 text-muted">Checking Spotify…</p>
      ) : now === 'idle' ? (
        <p className="mt-4 rounded-2xl bg-sunk p-4 text-muted">Play a song on Spotify (your playlist works well), and its lyrics follow along here.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            {now.track.image && <img src={now.track.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="han truncate font-semibold">{now.track.name}</p>
              <p className="han truncate text-sm text-muted">{now.track.artists.join(', ')}</p>
            </div>
          </div>
          {lyrics.kind === 'error' ? (
            <LyricsError retry={() => setAttempt((a) => a + 1)} />
          ) : !reader || lyrics.kind === 'loading' ? (
            <p className="mt-6 text-muted">Loading lyrics…</p>
          ) : reader === 'nodict' ? (
            <p className="mt-6 text-muted">The dictionary hasn't downloaded yet. Open the app with internet and try again.</p>
          ) : lyrics.kind === 'none' ? (
            <p className="mt-6 rounded-2xl bg-sunk p-4 text-muted">No lyrics found for this song on LRCLIB, under this title or artist.</p>
          ) : (
            <>
              {synced ? (
                <div className="mt-4 flex items-center gap-2 text-sm" role="group" aria-label="Lyrics timing">
                  <span className="text-muted">Timing</span>
                  <button onClick={() => changeNudge(-0.5)} className="h-9 rounded-full border border-line px-3 font-medium" aria-label="Lyrics half a second earlier">
                    −0.5 s
                  </button>
                  <span className="min-w-12 text-center tabular-nums">{nudge > 0 ? `+${nudge}` : nudge} s</span>
                  <button onClick={() => changeNudge(0.5)} className="h-9 rounded-full border border-line px-3 font-medium" aria-label="Lyrics half a second later">
                    +0.5 s
                  </button>
                  <span className="text-xs text-muted">remembered for this song</span>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">Only untimed lyrics exist for this song, so they don't follow the music by themselves.</p>
              )}
              <div className="mt-5 flex flex-col gap-4">
                {lines.map((l, i) =>
                  l.text ? (
                    <div key={i} ref={i === idx ? current : undefined} className={`transition ${!synced || i === idx ? '' : 'opacity-40'}`}>
                      <LyricLine text={l.text} reader={reader} showPy alwaysPy onWord={(token, anchor) => setWord({ token, anchor })} big={i === idx} progress={i === idx ? lineProgress : undefined} />
                      {i === idx && english?.line === l.text && english.text && <p className="mt-1 text-muted">{english.text}</p>}
                    </div>
                  ) : null,
                )}
              </div>
            </>
          )}
        </>
      )}
      {word && <WordPopover text={word.token.text} entry={word.token.entry} known={word.token.status === 'known'} anchor={word.anchor} onClose={() => setWord(null)} />}
    </div>
  );
}
