/** End of a session: XP, accuracy, new words, weakest tone pair today, streak, level, achievements. */
import { useEffect, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { db } from '../../db/db';
import { loadGameStats, unlockAchievements, type GameStats } from '../../lib/gameStats';
import type { Achievement } from '../../lib/gamify';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { shortGloss, useVocabData } from '../../lib/vocabData';
import { patternLabel, patternStats, weakestPair } from '../tonegym/model';
import type { SessionState } from './state';

export function SessionEnd({ st, onAgain }: { st: SessionState; onAgain: () => void }) {
  const settings = useSettings();
  const data = useVocabData();
  const [game, setGame] = useState<GameStats | null>(null);
  const [fresh, setFresh] = useState<Achievement[]>([]);
  useEffect(() => {
    sfx.finish();
    void (async () => {
      const row = await db.gameScores.get('sessions');
      // Count the session once (it may be shown again after a reload).
      const counted = (await db.meta.get(`session-counted:${st.plan.id}`))?.value;
      if (!counted) {
        await db.meta.put({ key: `session-counted:${st.plan.id}`, value: true });
        await db.gameScores.put({ id: 'sessions', best: Math.max(row?.best ?? 0, st.xp), plays: (row?.plays ?? 0) + 1, updatedAt: Date.now() });
      }
      const g = await loadGameStats(settings.dailyGoal);
      setGame(g);
      setFresh(await unlockAchievements(g));
    })();
  }, [st, settings.dailyGoal]);

  const accuracy = st.answered ? Math.round((st.right / st.answered) * 100) : 100;
  const weak = weakestPair(patternStats(st.tones.map((t) => ({ tones: t }))));
  const minutes = Math.max(1, Math.round((st.updatedAt - st.startedAt) / 60000));
  const lvl = game?.level;
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-8">
      <p className="text-center text-sm font-medium text-muted">{st.plan.mode === 'quick' ? 'Quick session' : 'Deep session'} done</p>
      <p className="anim-pop mt-2 text-center text-6xl font-bold tabular-nums text-gold">+{st.xp} XP</p>
      {game && (
        <p className="mt-2 text-center font-medium">
          {game.streak.todayDone ? `Daily goal reached · ${game.streak.current}-day streak` : `${Math.max(0, game.goal - game.streak.todayXp)} XP to today's goal`}
        </p>
      )}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Best combo" value={String(st.bestCombo)} />
        <Stat label="Minutes" value={String(minutes)} />
      </div>
      {lvl && (
        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Level {lvl.level}</span>
            <span className="tabular-nums text-muted">
              {lvl.into} / {lvl.span} XP
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-sunk">
            <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
          </div>
        </div>
      )}
      {fresh.length > 0 && (
        <section className="mt-6 rounded-2xl bg-amber-soft p-4">
          <h2 className="font-semibold">New achievement{fresh.length > 1 ? 's' : ''}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {fresh.map((a) => (
              <li key={a.id} className="anim-pop flex items-center gap-3">
                <span className="han flex h-11 w-11 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">{a.hanzi}</span>
                <span>
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm text-muted">{a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {weak && (
        <p className="mt-6 rounded-2xl bg-surface p-4">
          Weakest tone pair today: <span className="font-bold">{patternLabel(weak.pattern)}</span>
        </p>
      )}
      {st.newWords.length > 0 && data && (
        <section className="mt-6">
          <h2 className="font-semibold">New words ({st.newWords.length})</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {st.newWords.map((id) => {
              const w = data.byId.get(id);
              return (
                w && (
                  <li key={id} className="rounded-xl bg-surface px-3 py-1.5">
                    <TonePinyin pinyin={w.pinyin} className="font-semibold" /> <span className="text-sm text-muted">{shortGloss(w.gloss)}</span>
                  </li>
                )
              );
            })}
          </ul>
        </section>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <button onClick={() => go('')} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Home
        </button>
        <button onClick={onAgain} className="h-12 rounded-2xl border-2 border-line font-medium">
          Another {st.plan.mode} session
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
