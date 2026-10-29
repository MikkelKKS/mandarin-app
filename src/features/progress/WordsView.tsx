/** Every HSK 3.0 word, by level, grouped by how well you know it. */
import { PageHeader } from '../../components/PageHeader';
import { useMemo, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { WordPopover } from '../../components/WordPopover';
import { db, type ReviewItemRow } from '../../db/db';
import { parseCardId, wordState, type WordState } from '../../lib/review';
import { currentSettings, useSettings } from '../../lib/settings';
import { moveWords } from '../../lib/wordMove';
import { useLive } from '../../lib/useLive';
import { meaningOf, useVocab, type VocabRow } from '../../lib/vocabData';

const GROUPS: Array<{ id: WordState; title: string; note: string; cls: string }> = [
  { id: 'mature', title: 'Mature', note: 'Every skill 21+ days out', cls: 'border-jade bg-jade-soft' },
  { id: 'young', title: 'Young', note: 'In review, still settling', cls: 'border-jade/50 bg-surface' },
  { id: 'learning', title: 'Learning', note: 'Met, coming back often', cls: 'border-gold/60 bg-amber-soft' },
  { id: 'new', title: 'Not started', note: 'Still ahead', cls: 'border-line bg-surface' },
];
const LEVELS = [1, 2, 3, 4, 5, 6, 7];
const SHOW = 240;

const toneless = (p: string) => p.toLowerCase().normalize('NFC').replace(/[üǖǘǚǜ]|u:/g, 'v').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * Pure: words matching a search: characters anywhere in the word (学 finds
 * 学生, 同学), pinyin from the start (with or without tones or tone numbers),
 * or an English meaning containing it.
 */
export function searchWords(words: VocabRow[], q: string, meaning: (w: VocabRow) => string = (w) => w.gloss.join('; ')): VocabRow[] {
  const query = q.trim();
  if (!query) return [];
  const han = [...query].filter((c) => /\p{Script=Han}/u.test(c)).join('');
  if (han) return words.filter((w) => w.hanzi.includes(han));
  const letters = toneless(query.replace(/[1-5]/g, ''));
  const english = query.toLowerCase();
  return words.filter((w) => (letters && toneless(w.pinyin).startsWith(letters)) || (english.length >= 2 && `${meaning(w)}; ${w.gloss.join('; ')}`.toLowerCase().includes(english)));
}

export function WordsView() {
  const vocab = useVocab();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const { showHanzi } = useSettings();
  const [level, setLevel] = useState(1);
  const [more, setMore] = useState<Set<WordState>>(new Set());
  const [picked, setPicked] = useState<{ w: VocabRow; anchor: DOMRect } | null>(null);
  // "Move words": pick words (or whole groups), then a state to move them to.
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const [q, setQ] = useState('');
  /** Move the one word in the card that's open. */
  const moveOne = async (w: VocabRow, to: WordState) => {
    setBusy(true);
    await moveWords([w.id], to, currentSettings().retention);
    setBusy(false);
    setPicked(null);
    setMoved(`${w.pinyin} moved to ${GROUPS.find((g) => g.id === to)!.title}.`);
  };
  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  };
  const move = async (to: WordState) => {
    setBusy(true);
    const n = sel.size;
    await moveWords([...sel], to, currentSettings().retention);
    setBusy(false);
    setSel(new Set());
    setSelecting(false);
    setMoved(`${n.toLocaleString('en-GB')} word${n === 1 ? '' : 's'} moved to ${GROUPS.find((g) => g.id === to)!.title}.`);
  };

  const grouped = useMemo(() => {
    const byWord = new Map<string, ReviewItemRow[]>();
    for (const c of cards ?? []) {
      const p = parseCardId(c.id);
      if (p && p.facet !== 'sp') byWord.set(p.word, [...(byWord.get(p.word) ?? []), c]);
    }
    const out: Record<WordState, VocabRow[]> = { mature: [], young: [], learning: [], new: [] };
    const state = new Map<string, WordState>();
    // Searching looks through every level.
    const list = q.trim() ? searchWords(vocab ?? [], q, meaningOf) : (vocab ?? []).filter((w) => w.level === level);
    for (const w of list) {
      const s = wordState(byWord.get(w.id) ?? []);
      state.set(w.id, s);
      out[s].push(w);
    }
    return Object.assign(out, { state });
  }, [vocab, cards, level, q]);
  const searching = !!q.trim();
  const total = GROUPS.reduce((n, g) => n + grouped[g.id].length, 0);

  return (
    <div className={selecting ? 'pb-44' : 'pb-8'}>
      <PageHeader back={{ label: 'Library', to: 'library' }} title="HSK words" />
      <p className="mt-1 text-muted">
        {selecting ? 'Tap words to select them, then choose where to move them.' : 'All HSK 3.0 words, most common first. Tap one to hear it or move it.'}
      </p>
      <button
        onClick={() => {
          setSelecting(!selecting);
          setSel(new Set());
          setMoved(null);
        }}
        aria-pressed={selecting}
        className={`mt-3 h-11 rounded-2xl border px-4 font-medium ${selecting ? 'border-ink bg-sunk' : 'border-line bg-surface'}`}
      >
        {selecting ? 'Done moving' : 'Move words'}
      </button>
      {moved && (
        <p role="status" className="mt-2 text-sm font-medium text-jade">
          {moved}
        </p>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search: 学, xue, xue2, or study"
        aria-label="Search the HSK words"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mt-4 w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-jade"
      />
      <div className={`mt-3 grid grid-cols-7 gap-1.5 ${searching ? 'opacity-40' : ''}`} role="tablist" aria-label="HSK level">
        {LEVELS.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={level === l}
            onClick={() => {
              setLevel(l);
              setQ('');
            }}
            className={`h-11 rounded-xl border text-sm font-semibold ${level === l ? 'border-jade bg-jade text-jade-ink' : 'border-line bg-surface'}`}
          >
            {l === 7 ? '7–9' : l}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {searching ? `${total} word${total === 1 ? '' : 's'} found in all levels` : `${total - grouped.new.length} of ${total} started`}
      </p>
      {!vocab || !cards ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        GROUPS.map((g) => {
          const list = grouped[g.id];
          const shown = more.has(g.id) ? list : list.slice(0, SHOW);
          return (
            <section key={g.id} className="mt-7">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{g.title}</h2>
                <span className="flex items-baseline gap-3">
                  {selecting && list.length > 0 && (
                    <button
                      onClick={() => {
                        const all = list.every((w) => sel.has(w.id));
                        const next = new Set(sel);
                        list.forEach((w) => (all ? next.delete(w.id) : next.add(w.id)));
                        setSel(next);
                      }}
                      className="text-sm font-medium text-jade"
                    >
                      {list.every((w) => sel.has(w.id)) ? 'Unselect all' : 'Select all'}
                    </button>
                  )}
                  <span className="text-sm tabular-nums text-muted">{list.length}</span>
                </span>
              </div>
              <p className="text-xs text-muted">{g.note}</p>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-muted">None yet.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {shown.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={(ev) => (selecting ? toggle(w.id) : setPicked({ w, anchor: ev.currentTarget.getBoundingClientRect() }))}
                        className={`flex flex-col items-center rounded-xl border px-2.5 py-1.5 ${g.cls} ${selecting && sel.has(w.id) ? 'outline-3 outline-offset-1 outline-ink' : ''}`}
                        aria-label={`${w.pinyin}: ${meaningOf(w)}`}
                        aria-pressed={selecting ? sel.has(w.id) : undefined}
                      >
                        <TonePinyin pinyin={w.pinyin} className="text-base font-semibold" />
                        {(showHanzi || searching) && <span className="han text-sm text-muted">{w.hanzi}</span>}
                        {searching && <span className="text-[10px] text-muted">{w.level === 7 ? 'HSK 7–9' : `HSK ${w.level}`}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {list.length > shown.length && (
                <button onClick={() => setMore(new Set(more).add(g.id))} className="mt-3 text-sm font-medium text-jade">
                  Show all {list.length}
                </button>
              )}
            </section>
          );
        })
      )}
      {selecting && sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-auto md:right-4 md:w-[28rem]">
          <div className="rounded-2xl border border-line bg-surface p-3 shadow-lg" role="group" aria-label="Move the selected words">
            <p className="text-sm font-medium">
              Move {sel.size.toLocaleString('en-GB')} word{sel.size === 1 ? '' : 's'} to:
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[...GROUPS].reverse().map((g) => (
                <button key={g.id} disabled={busy} onClick={() => void move(g.id)} className={`h-11 rounded-xl border text-sm font-semibold ${g.cls} disabled:opacity-50`}>
                  {g.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {picked && (
        <WordPopover
          text={picked.w.hanzi}
          entry={{ hanzi: picked.w.hanzi, pinyin: picked.w.pinyin, key: '', defs: picked.w.gloss, hsk: picked.w.level, tones: '' }}
          audioId={picked.w.id}
          anchor={picked.anchor}
          onClose={() => setPicked(null)}
        >
          <div className="mt-3 border-t border-line pt-3" role="group" aria-label={`Move ${picked.w.pinyin} to`}>
            <p className="text-xs font-medium text-muted">Move to</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {[...GROUPS].reverse().map((g) => {
                const here = grouped.state.get(picked.w.id) === g.id;
                return (
                  <button
                    key={g.id}
                    disabled={busy || here}
                    onClick={() => void moveOne(picked.w, g.id)}
                    aria-current={here || undefined}
                    className={`h-10 rounded-lg border text-xs font-semibold ${g.cls} ${here ? 'opacity-50' : ''}`}
                  >
                    {g.id === 'new' ? 'Not started' : g.title}
                  </button>
                );
              })}
            </div>
          </div>
        </WordPopover>
      )}
    </div>
  );
}
