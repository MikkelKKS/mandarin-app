import { GrammarToggle } from '../../components/GrammarNote';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Close } from '../../components/icons';
import { ToneText, TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { wordByHanzi } from '../../content';
import { azureUrl, dictAudioUrl, hasChineseVoice, play, playUrl, speak } from '../../lib/audio';
import { loadVocab } from '../../lib/vocabData';
import { guessHanzi, isPinyinSentence, loadDict, plecoLink, romanKey, search, segment, type Dict, type Entry } from './dict';
import { looksLikeEnglishSentence, translate } from './translate';
import { MySentenceList, SaveSentenceCard } from './MySentences';
import { useQueuedWords } from './mywords';
import { LearnNext } from '../../components/LearnNext';
import { PageHeader } from '../../components/PageHeader';

let showNoVoice: (v: boolean) => void = () => {};

let azureByHanzi: Promise<Map<string, string>> | null = null;
/** HSK words with an Azure recording, by characters. */
function azureWords(): Promise<Map<string, string>> {
  azureByHanzi ??= loadVocab().then((v) => new Map(v.filter((w) => w.azure).map((w) => [w.hanzi, w.id])));
  return azureByHanzi;
}

/** Play a word: its Azure recording (course or HSK word), then the older dictionary recording, then the browser's voice. */
async function sayWord(hanzi: string): Promise<boolean> {
  const known = wordByHanzi(hanzi);
  if (known) {
    void play(known.id);
    return true;
  }
  const hsk = (await azureWords()).get(hanzi);
  if (hsk && (await playUrl(azureUrl(hsk, false)))) return true;
  if (await playUrl(dictAudioUrl(hanzi))) return true;
  if (await hasChineseVoice()) {
    void speak(hanzi);
    return true;
  }
  return false;
}

async function say(hanzi: string) {
  showNoVoice(!(await sayWord(hanzi)));
}

/** A sentence: the browser's voice if it has Chinese, otherwise the words' recordings one by one. */
async function saySentence(text: string, words: string[]) {
  if (await hasChineseVoice()) {
    void speak(text);
    return;
  }
  let ok = words.length > 0;
  for (const w of words) ok = (await sayWord(w)) && ok;
  showNoVoice(!ok);
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** "Break it down" and similar: search something else (in the page: a link; in a lesson's look-up sheet: in place). */
const SearchCtx = createContext<(q: string) => void>((q) => {
  location.hash = `#/dictionary?q=${encodeURIComponent(q)}`;
});

export function DictionaryView() {
  const [q, setQ] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('q') ?? '');
  // Follow "#/dictionary?q=…" links from elsewhere in the app.
  useEffect(() => {
    const h = () => {
      const next = new URLSearchParams(location.hash.split('?')[1] ?? '').get('q');
      if (next !== null) setQ(next);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return (
    <div className="pb-10">
      <PageHeader back={{ label: 'Library', to: 'library' }} title="Dictionary" />
      <DictionarySearch q={q} setQ={setQ} />
    </div>
  );
}

/**
 * The dictionary over a lesson or session: look up the words or the sentence
 * you just answered without leaving it. Close (or Escape) to carry on.
 */
export function DictionarySheet({ query, onClose }: { query: string; onClose: () => void }) {
  const [q, setQ] = useState(query);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <SearchCtx.Provider value={setQ}>
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Dictionary"
        // The lesson's own keys (Enter, space, 1–4) stay with the lesson while this is open.
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
        className="anim-rise fixed inset-0 z-50 overflow-y-auto bg-bg px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] outline-none"
      >
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Dictionary</h2>
            <button onClick={onClose} className="flex h-10 items-center gap-1.5 rounded-full border border-line px-4 font-medium">
              <Close className="h-4 w-4" /> Back to the lesson
            </button>
          </div>
          <DictionarySearch q={q} setQ={setQ} />
        </div>
      </div>
    </SearchCtx.Provider>
  );
}

function DictionarySearch({ q, setQ }: { q: string; setQ: (q: string) => void }) {
  const [dict, setDict] = useState<Dict | null | 'loading'>('loading');
  const dq = useDebounced(q, 200);
  const input = useRef<HTMLInputElement>(null);
  const [noVoice, setNoVoice] = useState(false);
  showNoVoice = setNoVoice;

  useEffect(() => {
    void loadDict().then(setDict);
  }, []);

  const result = useMemo(() => (dict && dict !== 'loading' ? search(dict, dq) : null), [dict, dq]);
  const toToken = (i: number) => document.getElementById(`tok-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-3 backdrop-blur">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Characters, pinyin, English or a sentence"
          aria-label="Search the dictionary"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg outline-none focus:border-jade"
        />
      </div>

      {noVoice && (
        <p className="mt-2 rounded-2xl bg-amber-soft p-3 text-sm" role="status">
          No recording for this one, and your browser has no Chinese voice. On Windows, add one in Settings → Time &amp; language → Speech → Add voices → Chinese (Simplified), then restart the browser.
        </p>
      )}
      {dict === 'loading' && <p className="mt-6 text-muted">Loading the dictionary…</p>}
      {dict === null && (
        <p className="mt-6 rounded-2xl bg-amber-soft p-4 text-sm">
          The dictionary couldn't be loaded. Check your connection. After the first load it works offline.
        </p>
      )}

      {result?.mode === 'empty' && (
        <>
          <UpNext />
          <MySentenceList />
        </>
      )}

      {result?.mode === 'words' && dict && dict !== 'loading' && isPinyinSentence(dq) && <PinyinSentenceCard dict={dict} q={dq} />}
      {result?.mode === 'words' && !isPinyinSentence(dq) && looksLikeEnglishSentence(dq) && <TranslationCard text={dq} dir="en-zh" dict={dict as Dict} />}

      {result?.mode === 'words' && (
        <>
          {result.entries.length === 0 && <p className="mt-6 text-muted">No matches. Try characters, pinyin (e.g. “ni3 hao3” or “nihao”) or a single English word.</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {result.entries.map((e, i) => (
              <EntryCard key={`${e.hanzi}-${e.pinyin}-${i}`} e={e} />
            ))}
          </ul>
        </>
      )}

      {result?.mode === 'sentence' && (
        <div className="mt-2">
          <div className="rounded-2xl bg-surface p-4 border border-line">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-3" lang="zh-CN">
              {result.tokens.map((t, i) =>
                t.entries.length ? (
                  <button key={i} onClick={() => toToken(i)} className="flex flex-col items-center rounded-lg px-1 hover:bg-sunk">
                    <TonePinyin pinyin={t.entries[0].pinyin} className="text-xs" />
                    <ToneText hanzi={t.text} pinyin={t.entries[0].pinyin} className="han text-2xl" />
                  </button>
                ) : (
                  <span key={i} className="han text-2xl text-muted">
                    {t.text}
                  </span>
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void saySentence(q, result.tokens.filter((t) => t.entries.length).map((t) => t.text))}
                className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium"
              >
                <Speaker className="h-4 w-4" /> Listen
              </button>
              <a href={plecoLink(q)} className="rounded-xl border border-line px-3 py-2 text-sm font-medium">
                Open in Pleco
              </a>
            </div>
          </div>
          <TranslationCard text={dq} dir="zh-en" sourceKey={romanKey(dict as Dict, dq)} />
          <SaveSentenceCard key={dq} dict={dict as Dict} hanzi={dq.trim()} />
          <ul className="mt-4 flex flex-col gap-2">
            {result.tokens.map((t, i) =>
              t.entries.length ? (
                <li key={i} id={`tok-${i}`}>
                  <EntryCard e={t.entries[0]} more={t.entries.slice(1)} />
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
    </>
  );
}

function EntryCard({ e, more = [] }: { e: Entry; more?: Entry[] }) {
  return (
    <div className="rounded-2xl bg-surface p-4 border border-line">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ToneText hanzi={e.hanzi} pinyin={e.pinyin} className="han text-3xl" />
          <TonePinyin pinyin={e.pinyin} className="ml-3 text-lg" />
          {e.hsk > 0 && <span className="ml-2 rounded-md bg-sunk px-1.5 py-0.5 align-middle text-xs text-muted">HSK {e.hsk}</span>}
          <p className="mt-1 text-sm leading-relaxed">{e.defs.slice(0, 6).join('; ')}</p>
          {more.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Also: {more.slice(0, 3).map((m) => `${m.pinyin}: ${m.defs[0]}`).join(' · ')}
            </p>
          )}
        </div>
        <button onClick={() => say(e.hanzi)} aria-label={`Hear ${e.hanzi}`} className="shrink-0 rounded-full bg-jade-soft p-2.5 text-jade">
          <Speaker className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <LearnNext entry={e} />
        <GrammarToggle word={e} />
        <a href={plecoLink(e.hanzi)} className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:border-ink/30">
          Open in Pleco
        </a>
      </div>
    </div>
  );
}

/** Words waiting to be taught first, from "Learn next". */
function UpNext() {
  const queued = useQueuedWords();
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-muted">Learning next</h2>
      {queued.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">Look up a word and tap “Learn next”: your next session teaches it before the usual new words.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {queued.map((w) => (
            <li key={w.id} className="rounded-xl border border-line bg-surface px-3 py-2">
              <TonePinyin pinyin={w.pinyin} className="font-semibold" />
              <span className="ml-2 text-sm text-muted">{w.gloss[0]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** In-app translation (online). Chinese → English, or English → Chinese with pinyin. */
function TranslationCard({ text, dir, sourceKey, dict }: { text: string; dir: 'zh-en' | 'en-zh'; sourceKey?: string; dict?: Dict }) {
  const [state, setState] = useState<{ status: 'loading' | 'done' | 'error'; text?: string; error?: string; source?: 'azure' | 'mymemory' }>({ status: 'loading' });
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: 'loading' });
    const t = setTimeout(() => {
      translate(text, dir, ctl.signal, sourceKey)
        .then((r) => setState({ status: 'done', text: r.text, source: r.source }))
        .catch((e: Error) => e.name !== 'AbortError' && setState({ status: 'error', error: e.message }));
    }, 500);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text, dir, online]);
  const zh = dir === 'en-zh' && state.text ? state.text : null;
  return (
    <section className="mt-3 rounded-2xl border border-jade/40 bg-surface p-4" aria-live="polite">
      <p className="flex justify-between gap-3 text-xs">
        <span className="font-semibold text-jade">{dir === 'zh-en' ? 'Translation' : 'In Chinese'}</span>
        {state.source && <span className="text-muted">{state.source === 'azure' ? 'Azure Translator' : 'MyMemory (rough; free)'}</span>}
      </p>
      {state.status === 'loading' && <p className="mt-1 text-muted">Translating…</p>}
      {state.status === 'error' && <p className="mt-1 text-sm">{state.error}</p>}
      {state.status === 'done' && !zh && <p className="mt-1 text-lg leading-snug">{state.text}</p>}
      {zh && (
        <div className="mt-1">
          {dict ? (
            <div className="flex flex-wrap items-end gap-x-2 gap-y-3" lang="zh-CN">
              {segment(dict, zh).map((t, i) =>
                t.entries.length ? (
                  <span key={i} className="flex flex-col items-center">
                    <TonePinyin pinyin={t.entries[0].pinyin} className="text-sm" />
                    <ToneText hanzi={t.text} pinyin={t.entries[0].pinyin} className="han text-3xl" />
                  </span>
                ) : (
                  <span key={i} className="han text-3xl text-muted">
                    {t.text}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className="han text-2xl" lang="zh-CN">
              {zh}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => void saySentence(zh, [...zh].filter((c) => /\p{Script=Han}/u.test(c)))} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-medium">
              <Speaker className="h-4 w-4" /> Listen
            </button>
            <BreakDown q={zh} />
          </div>
        </div>
      )}
    </section>
  );
}

/** Pinyin typed as a sentence: best-guess characters, then a translation. */
function PinyinSentenceCard({ dict, q }: { dict: Dict; q: string }) {
  const guess = useMemo(() => guessHanzi(dict, q), [dict, q]);
  if (!guess) return null;
  return (
    <>
      <section className="mt-3 rounded-2xl bg-surface p-4 border border-line">
        <p className="text-xs font-semibold text-muted">In characters (best guess)</p>
        <p className="han mt-1 text-3xl" lang="zh-CN">
          {guess.hanzi}
        </p>
        {!guess.complete && <p className="mt-1 text-xs text-muted">Some syllables didn't match a word. Check the spelling or add tone numbers (ni3 hao3).</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void saySentence(guess.hanzi, [...guess.hanzi])} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-medium">
            <Speaker className="h-4 w-4" /> Listen
          </button>
          <BreakDown q={guess.hanzi} />
        </div>
      </section>
      {guess.complete && <TranslationCard text={guess.hanzi} dir="zh-en" sourceKey={romanKey(dict, guess.hanzi)} />}
    </>
  );
}

function BreakDown({ q }: { q: string }) {
  const open = useContext(SearchCtx);
  return (
    <button onClick={() => open(q)} className="rounded-xl border border-line px-3 py-1.5 text-sm font-medium">
      Break it down
    </button>
  );
}
