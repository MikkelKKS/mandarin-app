/** Shared pieces for mini-games: word pool, scoring, timer and the game frame. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sentences, words } from '../../content';
import type { Sentence, Word } from '../../content/schema';
import { db, type ReviewItemRow } from '../../db/db';
import { Close } from '../../components/icons';
import { stop } from '../../lib/audio';
import type { Verdict } from '../../lib/pinyinAnswer';
import { go } from '../../lib/router';
import { sfx } from '../../lib/sfx';
import { recordAnswer } from '../../lib/srs';
import { useLive } from '../../lib/useLive';

export interface GameDef {
  id: string;
  title: string;
  hanzi: string;
  blurb: string;
  seconds: number;
  unit: string; // what the score counts
}

/** Weight: due, often-missed and shaky items come up more. Unseen items weight 1. */
export function weightOf(r?: ReviewItemRow, now = Date.now()): number {
  if (!r) return 1;
  let w = 1;
  if (r.due <= now) w += 2;
  w += Math.min(3, r.lapses);
  if (r.stability < 2) w += 1;
  return w;
}

export function pickWeighted<T extends { id: string }>(items: T[], weights: Map<string, number>, n: number, avoid = new Set<string>()): T[] {
  const pool = items.filter((i) => !avoid.has(i.id));
  const out: T[] = [];
  const taken = new Set<string>();
  while (out.length < n && taken.size < pool.length) {
    const left = pool.filter((i) => !taken.has(i.id));
    const total = left.reduce((s, i) => s + (weights.get(i.id) ?? 1), 0);
    let r = Math.random() * total;
    for (const i of left) {
      r -= weights.get(i.id) ?? 1;
      if (r <= 0) {
        out.push(i);
        taken.add(i.id);
        break;
      }
    }
  }
  return out;
}

export interface Pool {
  words: Word[];
  sentences: Sentence[];
  weights: Map<string, number>;
}

/** Unlocked words and sentences, with review weights. */
export function usePool(unlockedIds: string[]): Pool | null {
  return useLive(
    async () => {
      const ids = new Set(unlockedIds);
      const items = await db.reviewItems.bulkGet([...ids]);
      const weights = new Map<string, number>();
      [...ids].forEach((id, i) => weights.set(id, weightOf(items[i])));
      return {
        words: [...words.values()].filter((w) => ids.has(w.id)),
        sentences: [...sentences.values()].filter((s) => ids.has(s.id)),
        weights,
      };
    },
    [unlockedIds.join()],
    null,
  );
}

/** Records a game answer for review scheduling (once per item per game). */
export function useStudyRecorder(gameId: string) {
  const seen = useRef(new Set<string>());
  return (itemId: string, verdict: Verdict) => {
    if (seen.current.has(itemId) || !words.has(itemId) && !sentences.has(itemId)) return;
    seen.current.add(itemId);
    void recordAnswer(itemId, verdict, { exercise: `game:${gameId}` });
  };
}

export async function saveScore(gameId: string, score: number): Promise<boolean> {
  const prev = await db.gameScores.get(gameId);
  const isBest = score > (prev?.best ?? 0);
  await db.gameScores.put({ id: gameId, best: Math.max(score, prev?.best ?? 0), plays: (prev?.plays ?? 0) + 1, updatedAt: Date.now() });
  return isBest;
}

export function useBest(gameId: string): number {
  return useLive(async () => (await db.gameScores.get(gameId))?.best ?? 0, [gameId], 0);
}

/**
 * Frame: intro → playing (with countdown) → result. `children` gets the
 * score setter and plays while time remains.
 */
export function GameFrame({
  def,
  minItems,
  available,
  children,
}: {
  def: GameDef;
  minItems: number;
  available: number;
  children: (api: { addScore: (n?: number) => void; miss: () => void; running: boolean }) => ReactNode;
}) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(def.seconds);
  const [newBest, setNewBest] = useState(false);
  const [round, setRound] = useState(0);
  const best = useBest(def.id);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (phase !== 'play') return;
    const end = Date.now() + def.seconds * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        stop();
        sfx.finish();
        void saveScore(def.id, scoreRef.current).then(setNewBest);
        setPhase('done');
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase, def.id, def.seconds]);

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setLeft(def.seconds);
    setNewBest(false);
    setRound((r) => r + 1);
    setPhase('play');
  };

  useEffect(() => {
    if (phase === 'play') return;
    const h = (e: KeyboardEvent) => e.key === 'Enter' && available >= minItems && start();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const header = (
    <header className="flex items-center gap-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button onClick={() => (stop(), go('games'))} aria-label="Leave game" className="rounded-full p-2 text-muted hover:bg-sunk">
        <Close className="h-6 w-6" />
      </button>
      <h1 className="flex-1 font-semibold">{def.title}</h1>
      {phase === 'play' && (
        <>
          <span className={`tabular-nums font-semibold ${left <= 10 ? 'text-cinnabar' : 'text-muted'}`} aria-label="Seconds left">
            {left}s
          </span>
          <span className="min-w-12 rounded-xl bg-jade-soft px-3 py-1 text-center font-bold tabular-nums text-jade" aria-label="Score">
            {score}
          </span>
        </>
      )}
    </header>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8">
      {header}
      {phase === 'intro' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="han text-6xl font-bold text-cinnabar">{def.hanzi}</p>
          <h2 className="mt-4 text-2xl font-bold">{def.title}</h2>
          <p className="mt-2 max-w-sm text-muted">{def.blurb}</p>
          <p className="mt-4 text-sm text-muted">
            {def.seconds} seconds · Personal best: <b className="text-ink">{best}</b>
          </p>
          {available >= minItems ? (
            <button autoFocus onClick={start} className="mt-8 h-14 w-full max-w-xs rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
              Play
            </button>
          ) : (
            <p className="mt-8 rounded-2xl bg-sunk p-4 text-sm">Unlock a few more skills on the path first — this game needs more words to play with.</p>
          )}
        </div>
      )}
      {phase === 'play' && (
        <div className="flex-1" key={round}>
          {children({
            running: true,
            addScore: (n = 1) => {
              scoreRef.current += n;
              setScore(scoreRef.current);
            },
            miss: () => sfx.wrong(),
          })}
        </div>
      )}
      {phase === 'done' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted">Time!</p>
          <p className="anim-pop mt-2 text-7xl font-bold text-jade">{score}</p>
          <p className="text-muted">{def.unit}</p>
          {newBest ? (
            <p className="mt-4 rounded-full bg-amber-soft px-4 py-1 font-semibold">New personal best!</p>
          ) : (
            <p className="mt-4 text-sm text-muted">Personal best: {best}</p>
          )}
          <button autoFocus onClick={start} className="mt-8 h-14 w-full max-w-xs rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            Play again
          </button>
          <button onClick={() => go('games')} className="mt-3 h-12 w-full max-w-xs rounded-2xl border-2 border-line font-medium">
            All games
          </button>
        </div>
      )}
    </div>
  );
}
