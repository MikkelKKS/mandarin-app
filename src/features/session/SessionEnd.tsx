/** End of a session: XP, accuracy, new words, weakest tone pair today, streak, level, achievements. */
import { Seal, verdictText } from '../lesson/EndScreen';
import { ProgressBar } from '../../components/ProgressBar';
import { useEffect, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { db } from '../../db/db';
import { loadGameStats, unlockAchievements, type GameStats } from '../../lib/gameStats';
import { levelFor, type Achievement } from '../../lib/gamify';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { useCountUp } from '../../lib/countUp';
import { meaningOf, useVocabData } from '../../lib/vocabData';
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
  // This session crossed into a new level.
  const leveledUp = !!game && levelFor(Math.max(0, game.xp - st.xp)).level < game.level.level;
  const verdict = verdictText(accuracy / 100);
  // The XP counts up after the seal lands; the level bar fills from where this session started.
  const xpShown = useCountUp(st.xp, 700, 350);
  const [barIn, setBarIn] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const t = setTimeout(() => setBarIn(true), 650);
    return () => clearTimeout(t);
  }, []);
  // This session took you over today's goal.
  const goalNow = !!game && game.streak.todayDone && game.streak.todayXp - st.xp < game.goal;
  useEffect(() => {
    if (!goalNow) return;
    const t = setTimeout(() => sfx.correct(), 900);
    return () => clearTimeout(t);
  }, [goalNow]);
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <Seal hanzi={verdict.hanzi} small />
      <p className="anim-up mt-4 text-center text-sm text-muted [animation-delay:250ms]">
        {st.plan.mode === 'quick' ? 'Quick session' : st.plan.mode === 'reading' ? 'Reading round' : 'Deep session'} done · {verdict.title}
      </p>
      <p className="anim-up mt-1 num text-center text-numeral text-imperial [animation-delay:300ms]" aria-label={`+${st.xp} XP`}>
        +{xpShown} XP
      </p>
      {game && (
        goalNow ? (
          <p className="mt-3 flex items-center justify-center gap-3">
            <span className="anim-medal han grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-imperial text-sm font-bold text-imperial [animation-delay:900ms]" aria-hidden>
              达标
            </span>
            <span className="anim-up text-base font-semibold [animation-delay:1000ms]">Daily goal reached: {game.streak.current}-day streak</span>
          </p>
        ) : (
        <p className="anim-up mt-2 text-center text-base text-muted [animation-delay:360ms]">
          {game.streak.todayDone ? `Daily goal reached. ${game.streak.current}-day streak.` : `${Math.max(0, game.goal - game.streak.todayXp)} XP to today's goal`}
        </p>
        )
      )}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="Accuracy" value={`${accuracy}%`} delay={420} />
        <Stat label="Best combo" value={String(st.bestCombo)} delay={480} />
        <Stat label="Minutes" value={String(minutes)} delay={540} />
      </div>
      {lvl && leveledUp && (
        <div className="anim-band mt-6 rounded-card bg-imperial px-5 py-4 text-center text-surface shadow-md [animation-delay:1100ms]" role="status">
          <p className="text-sm font-semibold opacity-90">Level up</p>
          <p className="num text-numeral">Level {lvl.level}</p>
        </div>
      )}
      {lvl && (
        <div className="anim-up mt-6 [animation-delay:600ms]">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Level {lvl.level}</span>
            <span className="tabular-nums text-muted">
              {lvl.into} / {lvl.span} XP
            </span>
          </div>
          <ProgressBar value={barIn ? lvl.into / lvl.span : Math.max(0, lvl.into - st.xp) / lvl.span} label="Progress to the next level" tone="imperial" className="mt-2" />
        </div>
      )}
      {fresh.length > 0 && (
        <section className="card anim-up mt-6 bg-imperial-soft p-4 shadow-md [animation-delay:700ms]">
          <h2 className="font-semibold">New badge{fresh.length > 1 ? 's' : ''}</h2>
          <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4">
            {fresh.map((a, i) => (
              <li key={a.id} className="flex flex-col items-center text-center" title={a.detail}>
                <span
                  className="anim-medal han flex h-14 w-14 items-center justify-center rounded-full bg-imperial text-sm font-semibold text-surface shadow-[0_0_0_3px_var(--imperial-soft),0_0_0_4.5px_var(--imperial)]"
                  style={{ animationDelay: `${850 + i * 120}ms` }}
                  aria-hidden
                >
                  {a.hanzi}
                </span>
                <span className="mt-2 text-sm font-semibold leading-tight">{a.title}</span>
                <span className="mt-0.5 text-xs leading-tight text-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {weak && (
        <p className="card mt-6 p-4">
          Weakest tone pair today: <span className="font-semibold">{patternLabel(weak.pattern)}</span>
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
                  <li key={id} className="rounded-xl border border-line bg-surface px-3 py-1.5">
                    <TonePinyin pinyin={w.pinyin} className="font-semibold" /> <span className="text-sm text-muted">{meaningOf(w)}</span>
                  </li>
                )
              );
            })}
          </ul>
        </section>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <button onClick={() => go(st.plan.mode === 'reading' ? 'reading' : '')} className="btn btn-primary h-13">
          {st.plan.mode === 'reading' ? 'Back to Reading' : 'Home'}
        </button>
        <button onClick={onAgain} className="btn btn-quiet h-12">
          {st.plan.mode === 'reading' ? 'Another round' : `Another ${st.plan.mode} session`}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <div className="card anim-up p-3" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
