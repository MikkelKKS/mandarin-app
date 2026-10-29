/**
 * The Reading tab: what to train (character → meaning, character → pinyin or
 * a mix, remembered on this device), today's due and new counts, and a start
 * button for a round (due cards first, then new words with their characters).
 */
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { db } from '../../db/db';
import { readingStates, type ReadMode, type ReadQueue } from '../../lib/reading';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { useLive } from '../../lib/useLive';
import { READING } from '../session/plan';
import { loadSession, remainingItems } from '../session/state';
import { useReadData } from './data';
import { readMode, setReadMode } from './mode';
import { readingQueue } from './queue';

const MODES: Array<{ id: ReadMode; title: string; blurb: string }> = [
  { id: 'rm', title: 'Character → meaning', blurb: 'See it, say what it means, grade yourself' },
  { id: 'rp', title: 'Character → pinyin', blurb: 'See it, type how it sounds' },
  { id: 'mix', title: 'Mix', blurb: 'Both, for each word' },
];

export function ReadingView() {
  const settings = useSettings();
  const [mode, setMode] = useState<ReadMode>(readMode);
  const d = useReadData();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const resume = useLive(() => loadSession('reading'), [], null);
  const [q, setQ] = useState<ReadQueue | null>(null);
  useEffect(() => {
    let live = true;
    setQ(null);
    void readingQueue(mode).then((x) => live && setQ(x));
    return () => {
      live = false;
    };
  }, [mode, cards, settings.readingNewPerDay]);

  const states = useMemo(() => (cards ? readingStates(cards) : null), [cards]);
  const summary = useMemo(() => {
    if (!d || !states) return null;
    let words = 0;
    let chars = 0;
    for (const [id, s] of states) {
      if (s !== 'young' && s !== 'mature') continue;
      if (d.index.items.get(id)?.kind === 'word') words++;
      else chars++;
    }
    return { words, chars };
  }, [d, states]);

  const pick = (m: ReadMode) => {
    setMode(m);
    setReadMode(m);
  };
  const due = q ? q.due.length + q.pending.length : null;
  const newWords = q ? q.fresh.filter((f) => !f.via).length : null;
  const newChars = q ? q.fresh.filter((f) => f.via).length : null;
  const nothing = q && !due && !q.fresh.length;

  return (
    <div className="pb-10">
      <PageHeader title="Reading">
        Learn to read the words you already know by ear: the whole word and each of its characters. A word becomes readable once its listening card is in long-term review.
      </PageHeader>

      <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label="What to train">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => pick(m.id)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${mode === m.id ? 'border-jade bg-jade-soft' : 'border-line bg-surface'}`}
          >
            <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${mode === m.id ? 'border-jade bg-jade' : 'border-line'}`} aria-hidden />
            <span>
              <span className="block font-semibold">{m.title}</span>
              <span className="block text-sm text-muted">{m.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Due today</p>
          <p className="text-2xl font-semibold tabular-nums">{due ?? '–'}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">New today</p>
          <p className="text-2xl font-semibold tabular-nums">{newWords ?? '–'}</p>
          {!!newChars && <p className="text-xs text-muted">+ {newChars} characters in them</p>}
        </div>
      </div>

      {resume && resume.plan.mode === 'reading' && remainingItems(resume) > 0 && (
        <button onClick={() => go('session/reading/resume')} className="press mt-5 h-14 w-full rounded-2xl border border-jade bg-surface text-lg font-semibold text-jade">
          Resume round ({remainingItems(resume)} left)
        </button>
      )}
      <button
        onClick={() => go(`session/reading/${Date.now().toString(36)}`)}
        disabled={!q || !!nothing}
        className="press mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted"
      >
        {!q ? 'Loading…' : nothing ? 'Nothing to read right now' : `Start a round (up to ${READING.round})`}
      </button>
      {nothing && (
        <p className="mt-2 text-sm text-muted">
          {newWords === 0 && q.newLeft === 0
            ? `That's today's ${settings.readingNewPerDay} new words. More tomorrow.`
            : 'No words ready yet: words become readable once you know them by ear (keep doing sessions).'}
        </p>
      )}

      {summary && (summary.words > 0 || summary.chars > 0) && (
        <p className="mt-6 text-sm text-muted">
          You can read {summary.words.toLocaleString('en-GB')} {summary.words === 1 ? 'word' : 'words'} and {summary.chars.toLocaleString('en-GB')}{' '}
          {summary.chars === 1 ? 'character' : 'characters'}.{' '}
          <button onClick={() => go('progress')} className="underline underline-offset-2">
            Reading in Stats
          </button>
        </p>
      )}
      <p className="mt-6 text-xs text-muted">
        Character building blocks and origins from{' '}
        <a href="https://github.com/skishore/makemeahanzi" className="underline" target="_blank" rel="noreferrer">
          Make Me a Hanzi
        </a>{' '}
        (LGPL). New reading words a day: {settings.readingNewPerDay} (in Settings).
      </p>
    </div>
  );
}
