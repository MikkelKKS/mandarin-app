/** Every HSK 1 to 3 word in the course, grouped by how well you know it. */
import { useMemo, useState } from 'react';
import { words } from '../../content';
import type { Word } from '../../content/schema';
import { ToneText } from '../../components/Hanzi';
import { WordPopover } from '../../components/WordPopover';
import { db } from '../../db/db';
import { courseCards } from '../../lib/srs';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { isKnown } from '../../lib/stats';
import { useLive } from '../../lib/useLive';

type Group = 'known' | 'learning' | 'new';
const GROUPS: Array<{ id: Group; title: string; note: string; cls: string }> = [
  { id: 'known', title: 'Known', note: 'In long-term review', cls: 'border-jade bg-jade-soft' },
  { id: 'learning', title: 'Settling in', note: "Met, still coming back often", cls: 'border-gold/60 bg-amber-soft' },
  { id: 'new', title: 'Not learned yet', note: 'Still ahead on the path', cls: 'border-line bg-surface' },
];

export function WordsView() {
  const items = useLive(() => db.reviewItems.toArray().then(courseCards), [], null);
  const settings = useSettings();
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState<{ w: Word; anchor: DOMRect } | null>(null);

  const grouped = useMemo(() => {
    const byId = new Map((items ?? []).map((r) => [r.id, r]));
    const seen = new Set<string>();
    const out: Record<Group, Word[]> = { known: [], learning: [], new: [] };
    for (const w of words.values()) {
      if (w.hsk !== level || seen.has(w.hanzi)) continue;
      seen.add(w.hanzi);
      const r = byId.get(w.id);
      out[isKnown(r) ? 'known' : r ? 'learning' : 'new'].push(w);
    }
    return out;
  }, [items, level]);

  const total = grouped.known.length + grouped.learning.length + grouped.new.length;
  const showPy = settings.pinyinDisplay === 'always' || settings.pinyinDisplay === 'hover';

  return (
    <div className="pb-8">
      <button onClick={() => go('progress')} className="mb-3 text-sm font-medium text-jade">
        ← Progress
      </button>
      <h1 className="text-2xl font-bold">HSK words</h1>
      <p className="mt-1 text-muted">Every HSK word in the course. Tap one to hear it and see what it means.</p>

      <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="HSK level">
        {[1, 2, 3].map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={level === l}
            onClick={() => setLevel(l)}
            className={`h-11 rounded-xl border-2 font-semibold transition ${level === l ? 'border-jade bg-jade text-jade-ink' : 'border-line bg-surface'}`}
          >
            HSK {l}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {grouped.known.length} of {total} known
      </p>

      {items === null ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        GROUPS.map((g) => (
          <section key={g.id} className="mt-7">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <span className="text-sm tabular-nums text-muted">{grouped[g.id].length}</span>
            </div>
            <p className="text-xs text-muted">{g.note}</p>
            {grouped[g.id].length === 0 ? (
              <p className="mt-2 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {grouped[g.id].map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={(ev) => setPicked({ w, anchor: ev.currentTarget.getBoundingClientRect() })}
                      className={`group flex flex-col items-center rounded-xl border-2 px-2.5 py-1.5 transition hover:-translate-y-0.5 ${g.cls}`}
                      aria-label={`${w.hanzi} ${w.pinyin}: ${w.english[0]}`}
                    >
                      {showPy && (
                        <span className={`text-[11px] leading-none text-muted ${settings.pinyinDisplay === 'hover' ? 'invisible group-hover:visible' : ''}`}>{w.pinyin}</span>
                      )}
                      <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-2xl leading-tight" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {picked && (
        <WordPopover
          text={picked.w.hanzi}
          entry={{ hanzi: picked.w.hanzi, pinyin: picked.w.pinyin, key: '', defs: picked.w.english, hsk: picked.w.hsk, tones: '' }}
          audioId={picked.w.id}
          canAdd={false}
          anchor={picked.anchor}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
