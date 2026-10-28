/**
 * Conversations: the hand-written units (dialogues set around family life in
 * Beijing), as an optional side section. Nothing is locked. Progress is shared
 * with the rest of the app: a lesson's words you know from sessions count here,
 * and what you learn here counts in your sessions and Stats.
 */
import { useEffect, useMemo, useState } from 'react';
import { course, grammar, nodes, units, words } from '../../content';
import type { Unit } from '../../content/schema';
import { ToneText } from '../../components/Hanzi';
import { Book, Check, ChevronRight, Lightbulb } from '../../components/icons';
import { db } from '../../db/db';
import { courseWordState, isKnownState, useWordStates } from '../../lib/knowledge';
import { nodeStates, unitProgress, type NodeState } from '../../lib/progress';
import { focusNoScroll, go } from '../../lib/router';
import { useLive } from '../../lib/useLive';
import { hanziOnly } from '../../lib/pinyin';
import { PageHeader } from '../../components/PageHeader';
import { ProgressBar } from '../../components/ProgressBar';
import type { WordState } from '../../lib/review';

const OPEN_KEY = 'conversations:open';

export function PathView() {
  const rows = useLive(() => db.progress.toArray(), [], null);
  const known = useWordStates();
  const states = useMemo(() => (rows && known ? nodeStates(new Map(rows.map((r) => [r.id, r])), known) : null), [rows, known]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY);
    } catch {
      return null;
    }
  });
  // First visit: open the first unit that isn't finished.
  useEffect(() => {
    if (open !== null || !states) return;
    const u = units.find((x) => x.nodes.some((n) => !states.get(n.id)?.done));
    if (u) setOpen(u.id);
  }, [states, open]);
  const toggle = (id: string) => {
    const next = open === id ? '' : id;
    setOpen(next);
    try {
      sessionStorage.setItem(OPEN_KEY, next);
    } catch {
      /* not available */
    }
  };

  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Library', to: 'library' }} title="Conversations">
        Everyday dialogues set around family life in Beijing, with role-play. Words you know from your sessions count here, and what you learn here counts in your sessions.
      </PageHeader>
      {!states || !known ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        course.sections.map((sec) => (
          <section key={sec.id} className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted">{sec.title}</h2>
            <ul className="flex flex-col gap-2">
              {sec.units.map((uid) => {
                const u = units.find((x) => x.id === uid);
                return u ? (
                  <li key={u.id}>
                    <UnitRow unit={u} states={states} known={known} open={open === u.id} onToggle={() => toggle(u.id)} onNode={setSheet} />
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ))
      )}
      {sheet && states && known && <NodeSheet nodeId={sheet} state={states.get(sheet)!} known={known} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Unit title in tone-coloured characters, when its pinyin is known. */
function UnitTitle({ unit }: { unit: Unit }) {
  const match = unit.sentences.find((s) => hanziOnly(s.hanzi) === hanziOnly(unit.titleHanzi));
  if (match) return <ToneText hanzi={unit.titleHanzi} pinyin={match.pinyin} className="han mt-0.5 block text-base" />;
  return (
    <span className="han mt-0.5 block text-base text-muted" lang="zh-CN">
      {unit.titleHanzi}
    </span>
  );
}

function UnitRow({
  unit,
  states,
  known,
  open,
  onToggle,
  onNode,
}: {
  unit: Unit;
  states: Map<string, NodeState>;
  known: Map<string, WordState>;
  open: boolean;
  onToggle: () => void;
  onNode: (id: string) => void;
}) {
  const p = unitProgress(unit.id, states, known);
  const complete = p.done === p.lessons;
  return (
    <div className={`card overflow-hidden transition-shadow ${open ? 'shadow-md' : ''}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{unit.title}</span>
          <UnitTitle unit={unit} />
          <span className="mt-2 flex items-center gap-3">
            <ProgressBar value={p.total ? p.known / p.total : 0} label={`${unit.title}: words you know`} className="flex-1" />
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
              {p.known}/{p.total} words
            </span>
          </span>
        </span>
        {complete ? (
          <Check className="h-5 w-5 shrink-0 text-jade" aria-label="All lessons done" />
        ) : (
          <ChevronRight className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
        )}
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--ease-out)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <p className="px-4 text-sm text-muted">{unit.description}</p>
          <ol className="mt-2 divide-y divide-line border-t border-line">
            {unit.nodes.map((n) => {
              const node = nodes.get(n.id)!;
              const st = states.get(n.id)!;
              return (
                <li key={n.id}>
                  <button onClick={() => onNode(n.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunk/60">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${st.done ? 'bg-jade text-jade-ink' : 'bg-sunk text-ink'}`}>
                      {node.kind === 'story' ? (
                        <Book className="h-4 w-4" />
                      ) : (
                        <span className="han text-base" lang="zh-CN">
                          {nodeGlyph(n.id)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{node.title}</span>
                      <span className="block text-xs text-muted">
                        {node.kind === 'story' ? 'Listening story · role-play' : `${st.known} of ${st.total} words known`}
                        {st.completions > 0 ? ` · done ${st.completions}×` : ''}
                      </span>
                    </span>
                    {st.done && <Check className="h-4 w-4 text-jade" aria-label="Done" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function nodeGlyph(nodeId: string): string {
  const n = nodes.get(nodeId)!;
  const first = n.words.map((id) => words.get(id)).find(Boolean);
  return first ? [...first.hanzi][0] : '听';
}

function NodeSheet({ nodeId, state, known, onClose }: { nodeId: string; state: NodeState; known: Map<string, WordState>; onClose: () => void }) {
  const n = nodes.get(nodeId)!;
  const [tips, setTips] = useState(false);
  const notes = n.grammar.map((g) => grammar.get(g)!).filter(Boolean);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={n.title}
        className="anim-sheet max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">{n.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {n.kind === 'story' ? 'Listening story' : `${state.known} of ${state.total} words known`}
          {state.completions > 0 ? ` · done ${state.completions}×` : ''}
        </p>
        {n.words.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {n.words.map((id) => {
              const w = words.get(id)!;
              const k = isKnownState(courseWordState(id, known));
              return (
                <li key={id} className={`rounded-lg px-2 py-1 ${k ? 'bg-jade-soft' : 'bg-sunk'}`} title={k ? 'You know this word' : undefined}>
                  <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-lg" />
                </li>
              );
            })}
          </ul>
        )}

        {tips && (
          <div className="mt-5 flex flex-col gap-3">
            {notes.map((g) => (
              <article key={g.id} className="rounded-2xl bg-sunk p-4">
                <h3 className="font-semibold">{g.title}</h3>
                {g.body.split('\n').map((line, i) => (
                  <p key={i} className="han mt-2 text-sm leading-relaxed">
                    {line}
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button ref={focusNoScroll} onClick={() => go(`lesson/${nodeId}`)} className="btn btn-primary h-13">
            {n.kind === 'story' ? 'Listen' : state.completions === 0 ? 'Start' : 'Practise again'}
          </button>
          {n.kind === 'story' && (
            <button onClick={() => go(`lesson/${nodeId}/roleplay`)} className="btn btn-quiet h-12">
              Role-play
            </button>
          )}
          {notes.length > 0 && !tips && (
            <button onClick={() => setTips(true)} className="btn btn-quiet h-12 gap-2">
              <Lightbulb className="h-5 w-5" /> Grammar tips
            </button>
          )}
          <button onClick={onClose} className="h-11 rounded-2xl text-sm font-medium text-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
