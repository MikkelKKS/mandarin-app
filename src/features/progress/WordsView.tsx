/** Every HSK 3.0 word, by level, grouped by how well you know it. */
import { useMemo, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { WordPopover } from '../../components/WordPopover';
import { db, type ReviewItemRow } from '../../db/db';
import { parseCardId, wordState, type WordState } from '../../lib/review';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { useLive } from '../../lib/useLive';
import { shortGloss, useVocab, type VocabRow } from '../../lib/vocabData';

const GROUPS: Array<{ id: WordState; title: string; note: string; cls: string }> = [
  { id: 'mature', title: 'Mature', note: 'Every skill 21+ days out', cls: 'border-jade bg-jade-soft' },
  { id: 'young', title: 'Young', note: 'In review, still settling', cls: 'border-jade/50 bg-surface' },
  { id: 'learning', title: 'Learning', note: 'Met, coming back often', cls: 'border-gold/60 bg-amber-soft' },
  { id: 'new', title: 'Not started', note: 'Still ahead', cls: 'border-line bg-surface' },
];
const LEVELS = [1, 2, 3, 4, 5, 6, 7];
const SHOW = 240;

export function WordsView() {
  const vocab = useVocab();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const { showHanzi } = useSettings();
  const [level, setLevel] = useState(1);
  const [more, setMore] = useState<Set<WordState>>(new Set());
  const [picked, setPicked] = useState<{ w: VocabRow; anchor: DOMRect } | null>(null);

  const grouped = useMemo(() => {
    const byWord = new Map<string, ReviewItemRow[]>();
    for (const c of cards ?? []) {
      const p = parseCardId(c.id);
      if (p && p.facet !== 'sp') byWord.set(p.word, [...(byWord.get(p.word) ?? []), c]);
    }
    const out: Record<WordState, VocabRow[]> = { mature: [], young: [], learning: [], new: [] };
    for (const w of vocab ?? []) if (w.level === level) out[wordState(byWord.get(w.id) ?? [])].push(w);
    return out;
  }, [vocab, cards, level]);
  const total = GROUPS.reduce((n, g) => n + grouped[g.id].length, 0);

  return (
    <div className="pb-8">
      <button onClick={() => go('progress')} className="mb-3 text-sm font-medium text-jade">
        ← Stats
      </button>
      <h1 className="text-2xl font-bold">HSK words</h1>
      <p className="mt-1 text-muted">All HSK 3.0 words, most common first. Tap one to hear it.</p>
      <div className="mt-5 grid grid-cols-7 gap-1.5" role="tablist" aria-label="HSK level">
        {LEVELS.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={level === l}
            onClick={() => setLevel(l)}
            className={`h-11 rounded-xl border-2 text-sm font-semibold ${level === l ? 'border-jade bg-jade text-jade-ink' : 'border-line bg-surface'}`}
          >
            {l === 7 ? '7–9' : l}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {total - grouped.new.length} of {total} started
      </p>
      {!vocab || !cards ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        GROUPS.map((g) => {
          const list = grouped[g.id];
          const shown = more.has(g.id) ? list : list.slice(0, SHOW);
          return (
            <section key={g.id} className="mt-7">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{g.title}</h2>
                <span className="text-sm tabular-nums text-muted">{list.length}</span>
              </div>
              <p className="text-xs text-muted">{g.note}</p>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-muted">None yet.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {shown.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={(ev) => setPicked({ w, anchor: ev.currentTarget.getBoundingClientRect() })}
                        className={`flex flex-col items-center rounded-xl border-2 px-2.5 py-1.5 ${g.cls}`}
                        aria-label={`${w.pinyin}: ${shortGloss(w.gloss)}`}
                      >
                        <TonePinyin pinyin={w.pinyin} className="text-base font-semibold" />
                        {showHanzi && <span className="han text-sm text-muted">{w.hanzi}</span>}
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
      {picked && (
        <WordPopover
          text={picked.w.hanzi}
          entry={{ hanzi: picked.w.hanzi, pinyin: picked.w.pinyin, key: '', defs: picked.w.gloss, hsk: picked.w.level, tones: '' }}
          audioId={picked.w.id}
          canAdd={false}
          anchor={picked.anchor}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
