import { useMemo } from 'react';
import { db } from '../../db/db';
import { unlockedItemIds } from '../../lib/progress';
import { go } from '../../lib/router';
import { useLive } from '../../lib/useLive';
import { useNodeStates } from '../path/PathView';
import { GAMES, ListeningBlitz, MeasureMatch, PairRush, SentenceScramble, ToneSort } from './Games';
import { usePool } from './shared';
import { packItemIds, usePacks } from '../packs/store';

export function GamesView() {
  const scores = useLive(() => db.gameScores.toArray(), [], []);
  const best = new Map(scores.map((s) => [s.id, s]));
  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold">Games</h1>
      <p className="mt-1 text-muted">Unlimited plays. Games use words you've unlocked, lean towards the ones you find hard, and count as review.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {GAMES.map((g) => (
          <li key={g.id}>
            <button onClick={() => go(`game/${g.id}`)} className="flex w-full items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 text-left transition hover:border-jade">
              <span className="han flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cinnabar/10 text-xl font-bold text-cinnabar" aria-hidden>
                {g.hanzi}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{g.title}</span>
                <span className="block text-sm text-muted">{g.blurb}</span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-muted">Best</span>
                <span className="block text-xl font-bold tabular-nums">{best.get(g.id)?.best ?? '–'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GameRunner({ id }: { id: string }) {
  const states = useNodeStates();
  const packs = usePacks();
  const ids = useMemo(() => [...unlockedItemIds(states), ...packItemIds(packs)], [states, packs]);
  const pool = usePool(ids);
  if (!pool) return <p className="p-8 text-center text-muted">Loading…</p>;
  switch (id) {
    case 'tone-sort':
      return <ToneSort pool={pool} />;
    case 'listening-blitz':
      return <ListeningBlitz pool={pool} />;
    case 'pair-rush':
      return <PairRush pool={pool} />;
    case 'sentence-scramble':
      return <SentenceScramble pool={pool} />;
    case 'measure-match':
      return <MeasureMatch pool={pool} />;
    default:
      return <p className="p-8">Unknown game.</p>;
  }
}
