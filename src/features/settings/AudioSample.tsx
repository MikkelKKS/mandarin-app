/**
 * The Azure audio sample: 30 tricky items in both voices, to approve before
 * every word and sentence is generated.
 */
import { useEffect, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker, Turtle } from '../../components/icons';
import { stop } from '../../lib/audio';
import { go } from '../../lib/router';

interface Item {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  check: string;
  sentence?: boolean;
  hint: string | null;
  files: Record<string, string>;
}

const BASE = `${import.meta.env.BASE_URL}audio-sample/`;

export function AudioSample() {
  const [data, setData] = useState<{ voices: Record<string, string>; items: Item[] } | null | 'missing'>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const el = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`${BASE}items.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : 'missing'))
      .then(setData, () => setData('missing'));
    return () => el.current?.pause();
  }, []);

  const play = (file: string) => {
    stop();
    el.current?.pause();
    const a = new Audio(`${BASE}${file}`);
    el.current = a;
    setPlaying(file);
    a.onended = a.onerror = () => setPlaying((p) => (p === file ? null : p));
    void a.play().catch(() => setPlaying(null));
  };

  return (
    <div className="pb-10">
      <button onClick={() => go('settings')} className="mb-3 text-sm font-medium text-jade">
        ← Settings
      </button>
      <h1 className="text-2xl font-bold">Audio sample</h1>
      <p className="mt-1 text-muted">
        Thirty tricky items from Azure, in both voices. Each one says what to listen for. If they sound right, every word and sentence gets made the
        same way.
      </p>
      {data === null && <p className="mt-6 text-muted">Loading…</p>}
      {data === 'missing' && <p className="mt-6 rounded-2xl bg-sunk p-4">The sample hasn't been made yet. Check back in a few minutes.</p>}
      {data && data !== 'missing' && (
        <ul className="mt-6 flex flex-col gap-3">
          {data.items.map((it, i) => (
            <li key={it.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline gap-3">
                <span className="w-6 shrink-0 text-sm tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <TonePinyin pinyin={it.pinyin} className="text-xl font-semibold" />
                    <span className="han text-lg text-muted" lang="zh-CN">
                      {it.hanzi}
                    </span>
                  </p>
                  <p className="text-sm text-muted">{it.english}</p>
                  <p className="mt-1 text-sm">Listen for: {it.check}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 pl-9">
                {(['f', 'm'] as const).map((v) => (
                  <span key={v} className="flex gap-2">
                    <button
                      onClick={() => play(it.files[v])}
                      className={`flex h-10 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-medium ${playing === it.files[v] ? 'border-jade bg-jade-soft' : 'border-line'}`}
                    >
                      <Speaker className="h-4 w-4" /> {data.voices[v]}
                    </button>
                    {it.files[`${v}-slow`] && (
                      <button
                        onClick={() => play(it.files[`${v}-slow`])}
                        aria-label={`${data.voices[v]}, slow`}
                        className={`flex h-10 items-center rounded-xl border-2 px-2.5 ${playing === it.files[`${v}-slow`] ? 'border-jade bg-jade-soft' : 'border-line'}`}
                      >
                        <Turtle className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
