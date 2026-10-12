import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { course, grammar, nodes, units, words } from '../../content';
import type { Unit } from '../../content/schema';
import { ToneText } from '../../components/Hanzi';
import { Book, Check, Lock, Refresh, Lightbulb } from '../../components/icons';
import { computeStates, MAX_MASTERY, nextNode, unitComplete, type NodeState } from '../../lib/progress';
import { db } from '../../db/db';
import { focusNoScroll, go } from '../../lib/router';
import { useLive } from '../../lib/useLive';
import { hanziOnly } from '../../lib/pinyin';
import { nodeOrder } from '../../content';
import { InstallBanner } from '../settings/install';
import { PacksOnPath } from '../packs/PacksOnPath';
import { dueCount } from '../../lib/srs';

export function useNodeStates(): Map<string, NodeState> {
  const rows = useLive(() => db.progress.toArray(), [], []);
  return useMemo(() => computeStates(nodeOrder, new Map(rows.map((r) => [r.id, r]))), [rows]);
}

export function PathView() {
  const rows = useLive(() => db.progress.toArray(), [], null);
  const states = useMemo(() => computeStates(nodeOrder, new Map((rows ?? []).map((r) => [r.id, r]))), [rows]);
  const loaded = rows !== null;
  const next = nextNode(states);
  const [sheet, setSheet] = useState<string | null>(null);
  const due = useLive(() => dueCount(), [], 0);

  // Bring the skill you're on into view, once your progress has loaded.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!loaded || scrolled.current || !next) return;
    scrolled.current = true;
    if (next === nodeOrder[0]) return;
    const t = setTimeout(() => document.getElementById(`node-${next}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [loaded, next]);

  return (
    <div className="pb-8">
      <InstallBanner />
      <button
        onClick={() => go('practice')}
        className="group mb-8 flex w-full items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 text-left transition hover:border-jade active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-jade-soft text-jade">
          <Refresh className="h-6 w-6 transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:-rotate-180" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Practice</span>
          <span className={`block text-sm ${due > 0 ? 'font-medium text-jade' : 'text-muted'}`}>{due > 0 ? `${due} item${due === 1 ? '' : 's'} due for review` : 'Reviews and recent mistakes'}</span>
        </span>
      </button>

      <PacksOnPath />

      {course.sections.map((sec) => (
        <section key={sec.id} className="mb-10">
          <h2 className="mb-4 text-sm font-semibold text-muted">{sec.title}</h2>
          {sec.units.map((uid) => {
            const u = units.find((x) => x.id === uid);
            return u ? <UnitBlock key={u.id} unit={u} states={states} next={next} onNode={setSheet} /> : null;
          })}
        </section>
      ))}

      {course.upcoming.length > 0 && <section>
        <h2 className="mb-4 text-sm font-semibold text-muted">Coming next</h2>
        <ul className="flex flex-col gap-2">
          {course.upcoming.map((u) => (
            <li key={u.title} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-muted">
              <span className="han text-xl">{u.titleHanzi}</span>
              <span className="text-sm">{u.title}</span>
            </li>
          ))}
        </ul>
      </section>}

      {sheet && <NodeSheet nodeId={sheet} state={states.get(sheet)!} onClose={() => setSheet(null)} />}
    </div>
  );
}

const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52];

function UnitBlock({ unit, states, next, onNode }: { unit: Unit; states: Map<string, NodeState>; next?: string; onNode: (id: string) => void }) {
  const complete = unitComplete(unit.id, states);
  return (
    <div className="mb-10">
      <div className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
        <UnitTitle unit={unit} />
        <h3 className="mt-2 text-xl font-bold">{unit.title}</h3>
        <p className="mt-1 text-sm text-muted">{unit.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!complete && (
            <button onClick={() => go(`testout/${unit.id}`)} className="rounded-xl border-2 border-line px-3 py-2 text-sm font-medium hover:border-jade">
              Test out
            </button>
          )}
          {complete && (
            <span className="flex items-center gap-1 rounded-xl bg-jade-soft px-3 py-2 text-sm font-medium text-jade">
              <Check className="h-4 w-4" /> Unit complete
            </span>
          )}
        </div>
      </div>
      <ol className="mt-6 flex flex-col items-center gap-8">
        {unit.nodes.map((n, i) => {
          const st = states.get(n.id)!;
          const x = OFFSETS[i % OFFSETS.length];
          const prev = i > 0 ? OFFSETS[(i - 1) % OFFSETS.length] : null;
          return (
            <li key={n.id} id={`node-${n.id}`} className="relative" style={{ transform: `translateX(${x}px)` }}>
              {prev !== null && <Trail dx={prev - x} lit={st.status !== 'locked'} />}
              <div className="anim-node" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <NodeCoin nodeId={n.id} state={st} isNext={n.id === next} onClick={() => onNode(n.id)} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Three stepping-stone dots from the previous node down to this one. */
function Trail({ dx, lit }: { dx: number; lit: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-8">
      {[0.2, 0.5, 0.8].map((t) => (
        <span
          key={t}
          className={`absolute h-1.5 w-1.5 rounded-full transition-colors duration-500 ${lit ? 'bg-jade' : 'bg-line'}`}
          style={{ left: `calc(50% + ${dx * (1 - t)}px - 3px)`, top: `${t * 32 - 3}px` }}
        />
      ))}
    </span>
  );
}

/** Unit title in big tone-coloured characters. */
function UnitTitle({ unit }: { unit: Unit }) {
  // Find pinyin for the title from the unit's sentences when possible.
  const match = unit.sentences.find((s) => hanziOnly(s.hanzi) === hanziOnly(unit.titleHanzi));
  if (match) return <ToneText hanzi={unit.titleHanzi} pinyin={match.pinyin} className="han text-4xl font-bold" />;
  return (
    <span className="han text-4xl font-bold" lang="zh-CN">
      {unit.titleHanzi}
    </span>
  );
}

function nodeGlyph(nodeId: string): string {
  const n = nodes.get(nodeId)!;
  const first = n.words.map((id) => words.get(id)).find(Boolean);
  return first ? [...first.hanzi][0] : '听';
}

function NodeCoin({ nodeId, state, isNext, onClick }: { nodeId: string; state: NodeState; isNext: boolean; onClick: () => void }) {
  const n = nodes.get(nodeId)!;
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = state.mastery / MAX_MASTERY;
  const story = n.kind === 'story';
  const fill =
    state.status === 'done' ? 'bg-jade text-jade-ink' : state.status === 'open' ? 'bg-surface text-jade border-4 border-jade' : 'bg-sunk text-muted';
  return (
    <button onClick={onClick} className="group flex flex-col items-center" aria-label={`${n.title}, ${state.status === 'locked' ? 'locked' : `level ${state.mastery} of ${MAX_MASTERY}`}`}>
      <span className="relative flex h-24 w-24 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
          {frac > 0 && (
            <circle
              className="anim-ring transition-[stroke-dashoffset] duration-700"
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="var(--gold)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
              style={{ '--ring-c': `${c}px` } as CSSProperties}
            />
          )}
        </svg>
        <span
          className={`flex h-[72px] w-[72px] items-center justify-center rounded-full transition duration-200 group-active:scale-90 ${state.status === 'locked' ? '' : 'shadow-[inset_0_-4px_0_rgb(0_0_0/0.12)] group-hover:-translate-y-0.5'} ${fill} ${isNext ? 'anim-breathe' : ''}`}
        >
          {state.status === 'locked' ? (
            <Lock className="h-7 w-7" />
          ) : story ? (
            <Book className="h-8 w-8" />
          ) : (
            <span className="han text-3xl font-bold" lang="zh-CN">
              {nodeGlyph(nodeId)}
            </span>
          )}
        </span>
      </span>
      <span className="mt-1 max-w-36 text-center text-sm font-medium leading-tight">{n.title}</span>
    </button>
  );
}

function NodeSheet({ nodeId, state, onClose }: { nodeId: string; state: NodeState; onClose: () => void }) {
  const n = nodes.get(nodeId)!;
  const [tips, setTips] = useState(false);
  const notes = n.grammar.map((g) => grammar.get(g)!).filter(Boolean);
  const locked = state.status === 'locked';
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={n.title} className="anim-rise max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{n.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {locked ? 'Locked' : `Level ${state.mastery} of ${MAX_MASTERY}`}
          {n.kind === 'story' ? ' · Listening story' : ''}
        </p>
        {n.words.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {n.words.map((id) => {
              const w = words.get(id)!;
              return (
                <span key={id} className="rounded-lg bg-sunk px-2 py-1">
                  <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-lg" />
                </span>
              );
            })}
          </div>
        )}
        {locked ? (
          <p className="mt-5 text-muted">Finish the skill before this one, or take the unit's test-out to jump ahead.</p>
        ) : null}

        {tips && (
          <div className="stagger mt-5 flex flex-col gap-4">
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

        <div className="mt-6 flex flex-col gap-3">
          {!locked && (
            <button ref={focusNoScroll} onClick={() => go(`lesson/${nodeId}`)} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
              {state.mastery === 0 ? 'Start' : state.mastery >= MAX_MASTERY ? 'Play again' : 'Level up'}
            </button>
          )}
          {!locked && n.kind === 'story' && (
            <button onClick={() => go(`lesson/${nodeId}/roleplay`)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line font-medium">
              Role-play
            </button>
          )}
          {locked && (
            <button onClick={() => go(`testout/${nodes.get(nodeId)!.unit}`)} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
              Take the test-out
            </button>
          )}
          {notes.length > 0 && !tips && (
            <button onClick={() => setTips(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line font-medium">
              <Lightbulb className="h-5 w-5" /> Tips
            </button>
          )}
          <button onClick={onClose} className="h-12 rounded-2xl font-medium text-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
