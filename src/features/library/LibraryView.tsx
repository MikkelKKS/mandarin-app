/**
 * Library: everything beyond the daily sessions, in one place: look up a
 * word, the Conversations units, the stories, music, and the full HSK list.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { units } from '../../content';
import { ChevronRight, Search } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { courseWordState, isKnownState, isStartedState, useWordStates } from '../../lib/knowledge';
import { go } from '../../lib/router';
import { useVocab } from '../../lib/vocabData';
import { stories } from '../read/ReadView';

export function LibraryView() {
  const [q, setQ] = useState('');
  const states = useWordStates();
  const vocab = useVocab();
  const conv = useMemo(() => {
    if (!states) return null;
    const ids = [...new Set(units.flatMap((u) => u.words.map((w) => w.id)))];
    return { known: ids.filter((id) => isKnownState(courseWordState(id, states))).length, total: ids.length };
  }, [states]);
  const started = vocab && states ? vocab.filter((w) => isStartedState(states.get(w.id))).length : null;

  return (
    <div className="pb-8">
      <PageHeader title="Library">Everything beyond your daily sessions.</PageHeader>
      <form
        className="relative mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          go(`dictionary?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Look up a word or sentence"
          aria-label="Look up in the dictionary"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-13 w-full rounded-2xl border border-line bg-surface pl-12 pr-4 text-[1.0625rem] shadow-sm outline-none transition-colors placeholder:text-muted focus:border-jade"
        />
      </form>

      <ul className="group-list mt-6">
        <Row to="conversations" glyph="对话" title="Conversations" detail={conv ? `${units.length} units of everyday dialogues. You know ${conv.known} of their ${conv.total} words.` : `${units.length} units of everyday dialogues`} />
        <Row to="read" glyph="故事" title="Stories" detail={`${stories.length} short stories, read aloud`} />
        <Row to="music" glyph="音乐" title="Music" detail="Mandarin songs at your level, from Spotify" />
      </ul>
      <ul className="group-list mt-4">
        <Row to="words" glyph="词汇" title="HSK words" detail={started !== null && vocab ? `${started.toLocaleString('en-GB')} of ${vocab.length.toLocaleString('en-GB')} started. Browse them, or move words between stages.` : 'Every word by level'} />
        <Row to="dictionary" glyph="词典" title="Dictionary" detail="Characters, pinyin or English, with sentence breakdown" />
      </ul>
    </div>
  );
}

function Row({ to, glyph, title, detail }: { to: string; glyph: string; title: string; detail: ReactNode }) {
  return (
    <li>
      <button onClick={() => go(to)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-sunk/50">
        <span className="han flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunk text-[15px] font-medium text-ink" lang="zh-CN" aria-hidden>
          {glyph}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm leading-snug text-muted">{detail}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
      </button>
    </li>
  );
}
