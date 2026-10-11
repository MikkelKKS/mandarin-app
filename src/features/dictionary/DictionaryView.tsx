import { useEffect, useMemo, useRef, useState } from 'react';
import { ToneText, TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { wordByHanzi } from '../../content';
import { play, speak } from '../../lib/audio';
import { googleTranslateLink, loadDict, plecoLink, search, type Dict, type Entry } from './dict';
import { addMyWord, myWordId, removeMyWord, useMyWords } from './mywords';

function say(hanzi: string) {
  const known = wordByHanzi(hanzi);
  if (known) void play(known.id);
  else void speak(hanzi);
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function DictionaryView() {
  const [dict, setDict] = useState<Dict | null | 'loading'>('loading');
  const [q, setQ] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('q') ?? '');
  const dq = useDebounced(q, 200);
  const input = useRef<HTMLInputElement>(null);
  const mine = useMyWords();
  const mineIds = useMemo(() => new Set(mine.map((w) => w.id)), [mine]);

  useEffect(() => {
    void loadDict().then(setDict);
  }, []);

  const result = useMemo(() => (dict && dict !== 'loading' ? search(dict, dq) : null), [dict, dq]);

  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold">Dictionary</h1>
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-3 backdrop-blur">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Characters, pinyin or English — or paste a sentence"
          aria-label="Search the dictionary"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg outline-none focus:border-jade"
        />
      </div>

      {dict === 'loading' && <p className="mt-6 text-muted">Loading the dictionary (first time only — it's saved for offline use)…</p>}
      {dict === null && (
        <p className="mt-6 rounded-2xl bg-amber-soft p-4 text-sm">
          The dictionary couldn't be loaded. Check your connection — after the first successful load it works offline.
        </p>
      )}

      {result?.mode === 'empty' && <MyWords />}

      {result?.mode === 'words' && (
        <>
          {result.entries.length === 0 && <p className="mt-6 text-muted">No matches. Try characters, pinyin (e.g. “ni3 hao3” or “nihao”) or a single English word.</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {result.entries.map((e, i) => (
              <EntryCard key={`${e.hanzi}-${e.pinyin}-${i}`} e={e} added={mineIds.has(myWordId(e))} />
            ))}
          </ul>
        </>
      )}

      {result?.mode === 'sentence' && (
        <div className="mt-2">
          <div className="rounded-2xl bg-surface p-4">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-3" lang="zh-CN">
              {result.tokens.map((t, i) =>
                t.entries.length ? (
                  <a key={i} href={`#tok-${i}`} className="flex flex-col items-center rounded-lg px-1 hover:bg-sunk">
                    <TonePinyin pinyin={t.entries[0].pinyin} className="text-xs" />
                    <ToneText hanzi={t.text} pinyin={t.entries[0].pinyin} className="han text-2xl" />
                  </a>
                ) : (
                  <span key={i} className="han text-2xl text-muted">
                    {t.text}
                  </span>
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void speak(q)} className="flex items-center gap-2 rounded-xl border-2 border-line px-3 py-2 text-sm font-medium">
                <Speaker className="h-4 w-4" /> Listen
              </button>
              <a href={googleTranslateLink(q)} target="_blank" rel="noreferrer" className="rounded-xl border-2 border-line px-3 py-2 text-sm font-medium">
                Translate whole sentence ↗
              </a>
              <a href={plecoLink(q)} className="rounded-xl border-2 border-line px-3 py-2 text-sm font-medium">
                Open in Pleco
              </a>
            </div>
            <p className="mt-3 text-xs text-muted">Word-by-word breakdown. For a full translation, use the translate link.</p>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {result.tokens.map((t, i) =>
              t.entries.length ? (
                <li key={i} id={`tok-${i}`}>
                  <EntryCard e={t.entries[0]} more={t.entries.slice(1)} added={mineIds.has(myWordId(t.entries[0]))} />
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Dictionary data: CC-CEDICT, licensed CC BY-SA 4.0 (
        <a className="underline" href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noreferrer">
          mdbg.net
        </a>
        ).
      </p>
    </div>
  );
}

function EntryCard({ e, more = [], added }: { e: Entry; more?: Entry[]; added: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ToneText hanzi={e.hanzi} pinyin={e.pinyin} className="han text-3xl" />
          <TonePinyin pinyin={e.pinyin} className="ml-3 text-lg" />
          {e.hsk > 0 && <span className="ml-2 rounded-md bg-sunk px-1.5 py-0.5 align-middle text-xs text-muted">HSK {e.hsk}</span>}
          <p className="mt-1 text-sm leading-relaxed">{e.defs.slice(0, 6).join('; ')}</p>
          {more.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Also: {more.slice(0, 3).map((m) => `${m.pinyin} — ${m.defs[0]}`).join(' · ')}
            </p>
          )}
        </div>
        <button onClick={() => say(e.hanzi)} aria-label={`Hear ${e.hanzi}`} className="shrink-0 rounded-full bg-jade-soft p-2.5 text-jade">
          <Speaker className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {added ? (
          <button className="rounded-xl bg-jade-soft px-3 py-1.5 font-medium text-jade" onClick={() => removeMyWord(myWordId(e))}>
            ✓ In my practice
          </button>
        ) : (
          <button
            disabled={busy}
            className="rounded-xl border-2 border-line px-3 py-1.5 font-medium"
            onClick={async () => {
              setBusy(true);
              await addMyWord(e);
              setBusy(false);
            }}
          >
            + Add to my practice
          </button>
        )}
        <a href={plecoLink(e.hanzi)} className="rounded-xl border-2 border-line px-3 py-1.5 font-medium">
          Open in Pleco
        </a>
      </div>
    </div>
  );
}

function MyWords() {
  const mine = useMyWords();
  return (
    <section className="mt-4">
      <h2 className="text-sm font-semibold text-muted">My words</h2>
      {mine.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Words you add from the dictionary appear here and come up in Practice and Games.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {mine.map((w) => (
            <li key={w.id} className="rounded-xl bg-surface px-3 py-2">
              <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-xl" />
              <span className="ml-2 text-sm text-muted">{w.english[0]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
