/** Music: Mandarin songs from Spotify, ranked by how much of the lyrics you'd understand. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TonePinyin, ToneText } from '../../components/Hanzi';
import { Close, Music, Speaker } from '../../components/icons';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { loadDict, plecoLink, type Dict, type Entry } from '../dictionary/dict';
import { addMyWord, myWordId, useMyWords } from '../dictionary/mywords';
import { useStats } from '../progress/ProgressView';
import { findSongs, loadKnowledge, loadResults, loadT2s, saveResults, savePlaylist, type SavedResults, type ScoredSong } from './finder';
import { SCENES, sceneById, suggestScenes } from './genres';
import { fetchLyrics, type Lyrics } from './lyrics';
import { tokenize, type Knowledge, type LyricToken, type SongScore } from './score';
import * as sp from './spotify';

const K_SCENES = 'music:scenes';
const K_TASTE = 'music:taste';

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

const BAND: Record<SongScore['band'], { label: string; cls: string }> = {
  comfortable: { label: 'At your level', cls: 'bg-jade-soft text-jade' },
  stretch: { label: 'Stretch', cls: 'bg-amber-soft text-gold' },
  tough: { label: 'Tough', cls: 'bg-cinnabar-soft text-cinnabar' },
};

export function MusicRoute({ route }: { route: string[] }) {
  if (route[1] === 'song' && route[2]) return <SongView id={route[2]} />;
  if (route[1] === 'now') return <NowPlaying />;
  return <MusicView />;
}

function levelLabel(level: number): string {
  return level > 3 ? 'HSK 3 and up' : `HSK ${level}`;
}

export function MusicView() {
  const stats = useStats();
  const level = stats?.level ?? 1;
  const [connected, setConnected] = useState(sp.isConnected());
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<string[]>(() => readJson<string[]>(K_SCENES, []));
  const [taste, setTaste] = useState<{ artists: string[]; from: string[] } | null>(() => readJson(K_TASTE, null));
  const [results, setResults] = useState<SavedResults | null>(() => loadResults());
  const [progress, setProgress] = useState<{ done: number; total: number; found: number } | null>(null);
  const [playlist, setPlaylist] = useState<{ busy: boolean; url?: string; failed?: boolean; copied?: boolean }>({ busy: false });

  // Finish a Spotify login, then read the listener's taste once.
  useEffect(() => {
    void sp.finishLogin().then(async (err) => {
      if (err) setError(err);
      const ok = sp.isConnected();
      setConnected(ok);
      if (ok && !readJson(K_TASTE, null)) {
        try {
          const artists = await sp.topArtists();
          const s = suggestScenes(artists);
          const t = { artists: s.chineseArtists, from: artists.slice(0, 5).map((a) => a.name) };
          writeJson(K_TASTE, t);
          setTaste(t);
          if (!readJson<string[]>(K_SCENES, []).length) {
            const pick = level <= 2 ? ['easy', ...s.scenes.slice(0, 2)] : s.scenes;
            writeJson(K_SCENES, pick);
            setScenes(pick);
          }
        } catch {
          // Spotify doesn't allow every app to read top artists. Fall back to a sensible start.
          const t = { artists: [], from: [] };
          writeJson(K_TASTE, t);
          setTaste(t);
          if (!readJson<string[]>(K_SCENES, []).length) {
            const pick = level <= 2 ? ['easy', 'pop', 'ballad'] : ['pop', 'ballad', 'folk'];
            writeJson(K_SCENES, pick);
            setScenes(pick);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    const next = scenes.includes(id) ? scenes.filter((s) => s !== id) : [...scenes, id];
    setScenes(next);
    writeJson(K_SCENES, next);
  };

  const find = async () => {
    setError(null);
    setPlaylist({ busy: false });
    setProgress({ done: 0, total: 0, found: 0 });
    try {
      const dict = await loadDict();
      if (!dict) throw new Error('The dictionary is needed to read lyrics. Open the app once with internet, then try again.');
      const songs = await findSongs({
        scenes,
        extraArtists: taste?.artists ?? [],
        knowledge: await loadKnowledge(level),
        dict,
        onProgress: (done, total, found) => setProgress({ done, total, found }),
      });
      const r: SavedResults = { at: Date.now(), level, scenes, songs };
      saveResults(r);
      setResults(r);
      if (!songs.length) setError('No songs with Chinese lyrics turned up this time. Try again, or pick other genres.');
    } catch (e) {
      setError(`Couldn't search Spotify: ${(e as Error).message}`);
      setConnected(sp.isConnected());
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!results) return;
    setPlaylist({ busy: true });
    try {
      const url = await savePlaylist(results.songs, results.level);
      setPlaylist({ busy: false, url });
    } catch (e) {
      setError(`Spotify wouldn't create the playlist (${(e as Error).message}). Use "Copy song links" instead: paste them into any Spotify playlist on your PC with Ctrl+V.`);
      setPlaylist({ busy: false, failed: true });
    }
  };

  const copyLinks = async () => {
    if (!results) return;
    const text = results.songs.map((s) => s.track.url).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setPlaylist((p) => ({ ...p, copied: true }));
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  };

  const counts = useMemo(() => {
    const c = { comfortable: 0, stretch: 0, tough: 0 };
    for (const s of results?.songs ?? []) c[s.score.band]++;
    return c;
  }, [results]);

  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold">Music</h1>
      <p className="mt-1 text-muted">Mandarin songs from Spotify, sorted by how much of the lyrics you'd understand at {levelLabel(level)}.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-cinnabar-soft p-4 text-sm text-cinnabar">
          {error}
        </p>
      )}

      {!sp.clientId() ? (
        <p className="mt-6 rounded-2xl bg-sunk p-4 text-muted">Spotify isn't set up for this app yet.</p>
      ) : !connected ? (
        <div className="mt-6 rounded-3xl bg-surface p-5">
          <Music className="h-8 w-8 text-jade" />
          <h2 className="mt-3 text-lg font-semibold">Connect your Spotify</h2>
          <p className="mt-1 text-sm text-muted">
            The app looks at your top artists to pick genres, then saves a playlist of Mandarin songs at your level to your account. Needs Spotify Premium.
          </p>
          <button onClick={() => void sp.login()} className="mt-4 h-12 w-full rounded-2xl bg-jade font-semibold text-jade-ink">
            Connect Spotify
          </button>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Genres</h2>
            {taste && taste.from.length > 0 && <p className="text-sm text-muted">Picked from your top artists ({taste.from.slice(0, 3).join(', ')}). Change them any time.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {SCENES.map((s) => {
                const on = scenes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-medium ${on ? 'border-jade bg-jade-soft text-jade' : 'border-line bg-surface'}`}
                  >
                    <span className="han mr-1.5" lang="zh-CN">
                      {s.hanzi}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>
            {scenes.length === 1 && <p className="mt-2 text-sm text-muted">{sceneById(scenes[0])?.note}</p>}
            <button
              onClick={() => void find()}
              disabled={!scenes.length || !!progress}
              className="mt-4 h-12 w-full rounded-2xl bg-jade font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted"
            >
              {progress ? 'Finding songs…' : results ? 'Find new songs' : 'Find songs'}
            </button>
            {progress && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-sunk">
                  <span className="block h-full bg-jade transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {progress.total ? `Reading lyrics: ${progress.done} of ${progress.total} songs, ${progress.found} in Mandarin so far` : 'Searching Spotify…'}
                </p>
              </div>
            )}
          </section>

          {results && results.songs.length > 0 && !progress && (
            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{results.songs.length} songs</h2>
                <span className="text-sm text-muted">
                  {counts.comfortable} comfortable, {counts.stretch} stretch, {counts.tough} tough
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => void save()} disabled={playlist.busy} className="h-12 flex-1 rounded-2xl bg-jade font-semibold text-jade-ink disabled:opacity-60">
                  {playlist.busy ? 'Saving…' : playlist.url ? 'Saved to Spotify' : 'Save as Spotify playlist'}
                </button>
                <button onClick={() => go('music/now')} className="h-12 rounded-2xl border-2 border-line px-4 font-medium">
                  Follow along
                </button>
              </div>
              {playlist.failed && (
                <button onClick={() => void copyLinks()} className="mt-2 h-11 w-full rounded-2xl border-2 border-line font-medium">
                  {playlist.copied ? 'Copied! Paste into a Spotify playlist' : 'Copy song links'}
                </button>
              )}
              {playlist.url && (
                <a href={playlist.url} target="_blank" rel="noreferrer" className="mt-2 block text-center text-sm font-medium text-jade underline">
                  Open the playlist in Spotify
                </a>
              )}
              <ul className="stagger mt-4 flex flex-col gap-2">
                {results.songs.map((s) => (
                  <SongRow key={s.track.id} s={s} />
                ))}
              </ul>
            </section>
          )}

          <p className="mt-10 text-xs text-muted">
            Lyrics come from{' '}
            <a className="underline" href="https://lrclib.net" target="_blank" rel="noreferrer">
              LRCLIB
            </a>{' '}
            and are read on your device only.{' '}
            <button
              className="underline"
              onClick={() => {
                sp.disconnect();
                setConnected(false);
              }}
            >
              Disconnect Spotify
            </button>
          </p>
        </>
      )}
    </div>
  );
}

function SongRow({ s }: { s: ScoredSong }) {
  const b = BAND[s.score.band];
  return (
    <li>
      <button onClick={() => go(`music/song/${s.track.id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left transition duration-150 hover:bg-sunk active:scale-[0.99]">
        {s.track.image ? <img src={s.track.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-sunk" />}
        <span className="min-w-0 flex-1">
          <span className="han block truncate font-semibold">{s.track.name}</span>
          <span className="han block truncate text-sm text-muted">{s.track.artists.join(', ')}</span>
        </span>
        <span className="text-right">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>
          <span className="mt-0.5 block text-xs tabular-nums text-muted">you know {Math.round(s.score.knownShare * 100)}%</span>
        </span>
      </button>
    </li>
  );
}

/** Dictionary, character map and what you know, for reading lyrics. */
function useReader(): { dict: Dict; t2s: Record<string, string>; k: Knowledge } | null | 'nodict' {
  const stats = useStats();
  const [r, setR] = useState<{ dict: Dict; t2s: Record<string, string>; k: Knowledge } | null | 'nodict'>(null);
  const level = stats?.level;
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

function SongView({ id }: { id: string }) {
  const saved = loadResults()?.songs.find((s) => s.track.id === id);
  const [track, setTrack] = useState<sp.Track | null>(saved?.track ?? null);
  const [lyrics, setLyrics] = useState<Lyrics | null | 'none' | 'error'>(null);
  const reader = useReader();
  const [showPy, setShowPy] = useState(true);
  const [word, setWord] = useState<OpenWord | null>(null);

  useEffect(() => {
    if (!track && sp.isConnected()) void sp.track(id).then(setTrack).catch(() => setLyrics('error'));
  }, [id, track]);
  useEffect(() => {
    if (!track) return;
    fetchLyrics(track)
      .then((l) => setLyrics(l ?? 'none'))
      .catch(() => setLyrics('error'));
  }, [track]);

  return (
    <div className="pb-8">
      <button onClick={() => go('music')} className="mb-3 text-sm font-medium text-jade">
        ← Music
      </button>
      {track && (
        <div className="flex items-center gap-4">
          {track.image && <img src={track.image} alt="" className="h-20 w-20 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="han truncate text-2xl font-bold">{track.name}</h1>
            <p className="han truncate text-muted">{track.artists.join(', ')}</p>
            <a href={track.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-10 items-center rounded-full bg-jade px-4 text-sm font-semibold text-jade-ink">
              Play in Spotify
            </a>
          </div>
        </div>
      )}
      {saved && <Summary score={saved.score} reader={reader} onWord={(token, anchor) => setWord({ token, anchor })} />}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lyrics</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPy} onChange={(e) => setShowPy(e.target.checked)} className="h-4 w-4 accent-[var(--jade)]" />
          Pinyin
        </label>
      </div>
      <Legend />
      {lyrics === null || !reader ? (
        <p className="mt-4 text-muted">Loading lyrics…</p>
      ) : reader === 'nodict' ? (
        <p className="mt-4 text-muted">The dictionary hasn't downloaded yet. Open the app with internet and try again.</p>
      ) : lyrics === 'none' ? (
        <p className="mt-4 text-muted">No lyrics found for this song.</p>
      ) : lyrics === 'error' ? (
        <p className="mt-4 text-muted">Couldn't load the lyrics. Check your connection.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {dedupe(lyrics.lines.map((l) => l.text)).map((line, i) =>
            line ? <LyricLine key={i} text={line} reader={reader} showPy={showPy} onWord={(token, anchor) => setWord({ token, anchor })} /> : <span key={i} className="h-2" />,
          )}
        </div>
      )}
      {word && <WordPopover token={word.token} anchor={word.anchor} onClose={() => setWord(null)} />}
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

function Summary({ score, reader, onWord }: { score: SongScore; reader: ReturnType<typeof useReader>; onWord: OnWord }) {
  const b = BAND[score.band];
  const entryOf = (h: string) => (reader && reader !== 'nodict' ? reader.dict.byHanzi.get(h)?.[0] : undefined);
  return (
    <div className="mt-5 rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${b.cls}`}>{b.label}</span>
        <span className="text-sm text-muted">
          You know {Math.round(score.knownShare * 100)}% of the words. {Math.round(score.fit * 100)}% are within your level.
        </span>
      </div>
      {score.unknown.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium">Words to learn from this song</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {score.unknown.slice(0, 10).map((u) => (
              <button key={u.hanzi} onClick={(ev) => onWord({ text: u.hanzi, entry: entryOf(u.hanzi), status: 'hard' }, ev.currentTarget.getBoundingClientRect())} className="han rounded-lg bg-sunk px-2 py-1 text-lg">
                {u.hanzi}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Context-aware pinyin for whole lyric lines (pinyin-pro, loaded only when lyrics are shown). */
type PinyinFn = (text: string) => string[];
let pinyinFn: Promise<PinyinFn> | null = null;
function usePinyinFn(): PinyinFn | null {
  const [fn, setFn] = useState<PinyinFn | null>(null);
  useEffect(() => {
    pinyinFn ??= import('pinyin-pro').then((m) => (text: string) => m.pinyin(text, { type: 'array', nonZh: 'removed' }));
    let live = true;
    void pinyinFn.then((f) => live && setFn(() => f));
    return () => {
      live = false;
    };
  }, []);
  return fn;
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
        const reading = syllables ? syllables.slice(start, start + len).join('') : t.entry?.pinyin.replace(/ /g, '') ?? '';
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

/** A small card next to the tapped word. No backdrop, so the song and lyrics stay visible. */
function WordPopover({ token, anchor, onClose }: { token: LyricToken; anchor: DOMRect; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const mine = useMyWords();
  const [busy, setBusy] = useState(false);
  const e: Entry | undefined = token.entry;
  const added = e ? mine.some((w) => w.id === myWordId(e)) : false;
  useEffect(() => {
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && close.current();
    // Tapping anywhere else closes it (the tap on another word then opens that one).
    const down = (ev: PointerEvent) => {
      if (!box.current?.contains(ev.target as Node)) close.current();
    };
    window.addEventListener('keydown', key);
    const t = setTimeout(() => document.addEventListener('pointerdown', down), 0);
    return () => {
      window.removeEventListener('keydown', key);
      clearTimeout(t);
      document.removeEventListener('pointerdown', down);
    };
  }, []);
  const say = () => {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(token.text);
    u.lang = 'zh-CN';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  // Place it below the word (or above when there's no room), inside the screen, in page coordinates so it scrolls with the lyrics.
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 12)) + window.scrollX;
  const below = anchor.bottom + 230 < window.innerHeight;
  const top = (below ? anchor.bottom + 8 : anchor.top - 8) + window.scrollY;
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={token.text}
      className="anim-pop absolute z-40 rounded-2xl border border-line bg-surface p-4 shadow-xl"
      style={{ left, top, width, transform: below ? undefined : 'translateY(-100%)' }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {e ? <ToneText hanzi={e.hanzi} pinyin={e.pinyin} className="han text-3xl" /> : <span className="han text-3xl">{token.text}</span>}
          {e && <TonePinyin pinyin={e.pinyin} className="ml-2 text-base" />}
          {e && e.hsk > 0 && <span className="ml-2 rounded-md bg-sunk px-1.5 py-0.5 align-middle text-xs text-muted">HSK {e.hsk}</span>}
        </div>
        <button onClick={say} aria-label={`Hear ${token.text}`} className="rounded-full bg-jade-soft p-2 text-jade">
          <Speaker className="h-4 w-4" />
        </button>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-sunk">
          <Close className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{e ? e.defs.slice(0, 4).join('; ') : 'Not in the dictionary.'}</p>
      {token.status === 'known' && <p className="mt-1 text-xs text-jade">You know this one.</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {e && (
          <button
            disabled={added || busy}
            onClick={async () => {
              setBusy(true);
              await addMyWord(e);
              setBusy(false);
            }}
            className={`rounded-xl px-3 py-1.5 font-medium ${added ? 'bg-jade-soft text-jade' : 'border-2 border-line'}`}
          >
            {added ? '✓ In my practice' : '+ Add to my practice'}
          </button>
        )}
        <a href={plecoLink(token.text)} className="rounded-xl border-2 border-line px-3 py-1.5 font-medium">
          Open in Pleco
        </a>
      </div>
    </div>,
    document.body,
  );
}

type OnWord = (t: LyricToken, anchor: DOMRect) => void;
interface OpenWord {
  token: LyricToken;
  anchor: DOMRect;
}

/** Shows the line being sung in whatever is playing on Spotify right now. */
function NowPlaying() {
  const [now, setNow] = useState<sp.NowPlaying | null | 'idle'>(null);
  const [lyrics, setLyrics] = useState<Lyrics | null | 'none'>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reader = useReader();
  const [word, setWord] = useState<OpenWord | null>(null);
  const trackId = now && now !== 'idle' ? now.track.id : null;
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
  useEffect(() => {
    if (!trackId || now === null || now === 'idle') return;
    setLyrics(null);
    fetchLyrics(now.track)
      .then((l) => setLyrics(l ?? 'none'))
      .catch(() => setLyrics('none'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);
  // Smooth clock between polls.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const position = now && now !== 'idle' ? now.progressMs + (now.playing ? Date.now() - now.at : 0) : 0;
  const lines = lyrics && lyrics !== 'none' ? lyrics.lines : [];
  const synced = lyrics && lyrics !== 'none' && lyrics.synced;
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

  useEffect(() => {
    // Don't pull the page away while you're looking up a word.
    if (!word) current.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div className="pb-8">
      <button onClick={() => go('music')} className="mb-3 text-sm font-medium text-jade">
        ← Music
      </button>
      <h1 className="text-2xl font-bold">Follow along</h1>
      {error && <p className="mt-3 rounded-2xl bg-cinnabar-soft p-4 text-sm text-cinnabar">{error}</p>}
      {now === null ? (
        <p className="mt-4 text-muted">Checking Spotify…</p>
      ) : now === 'idle' ? (
        <p className="mt-4 rounded-2xl bg-sunk p-4 text-muted">Play a song on Spotify (your playlist works well), and its lyrics follow along here.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            {now.track.image && <img src={now.track.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div className="min-w-0">
              <p className="han truncate font-semibold">{now.track.name}</p>
              <p className="han truncate text-sm text-muted">{now.track.artists.join(', ')}</p>
            </div>
          </div>
          {!reader || lyrics === null ? (
            <p className="mt-6 text-muted">Loading lyrics…</p>
          ) : reader === 'nodict' || lyrics === 'none' ? (
            <p className="mt-6 text-muted">No lyrics found for this song.</p>
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              {!synced && <p className="text-sm text-muted">These lyrics aren't timed, so they don't scroll by themselves.</p>}
              {lines.map((l, i) =>
                l.text ? (
                  <div key={i} ref={i === idx ? current : undefined} className={`transition ${!synced || i === idx ? '' : 'opacity-40'}`}>
                    <LyricLine text={l.text} reader={reader} showPy alwaysPy onWord={(token, anchor) => setWord({ token, anchor })} big={i === idx} progress={i === idx ? lineProgress : undefined} />
                  </div>
                ) : null,
              )}
            </div>
          )}
        </>
      )}
      {word && <WordPopover token={word.token} anchor={word.anchor} onClose={() => setWord(null)} />}
    </div>
  );
}
