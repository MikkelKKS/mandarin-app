/**
 * Home (CLAUDE.md §7): today's goal, streak and level; one main action (Quick
 * session on a phone, Deep session on a PC); resume; the Tone Gym with your
 * weakest pair of the week; the next achievement. Everything else is in Library.
 */
import { sessionPreview } from '../session/plan';
import { useEffect, useMemo, useState } from 'react';
import { wordOrder } from '../session/beijing';
import { db } from '../../db/db';
import { ACHIEVEMENTS } from '../../lib/gamify';
import { useGameStats } from '../../lib/gameStats';
import { todaysQueue, type Queue } from '../../lib/review';
import { go } from '../../lib/router';
import { micActive, setSpeakPausedUntil, useSettings, useSpeakPausedUntil } from '../../lib/settings';
import { micSupported } from '../../lib/pitchTrack';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';
import { patternLabel, patternStats, weakestPair } from '../tonegym/model';
import { loadSession, remainingItems } from '../session/state';
import { InstallBanner } from '../settings/install';
import { ChevronRight, Flame } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';

const WEEK = 7 * 864e5;

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / Math.max(1, goal));
  return (
    <svg viewBox="0 0 64 64" className="h-[72px] w-[72px] -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunk)" strokeWidth="5" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={frac >= 1 ? 'var(--jade)' : 'var(--gold)'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

export function HomeView() {
  const settings = useSettings();
  const speakPaused = useSpeakPausedUntil();
  const vocab = useVocab();
  const game = useGameStats(settings.dailyGoal);
  const resume = useLive(() => loadSession(), [], null);
  const toneLogs = useLive(() => db.reviewLogs.where('at').above(Date.now() - WEEK).filter((l) => !!l.tones && !l.replaced).toArray(), [], []);
  const cards = useLive(() => db.reviewItems.count(), [], 0);
  const [queue, setQueue] = useState<Queue | null>(null);
  useEffect(() => {
    if (!vocab) return;
    void todaysQueue(wordOrder(vocab.map((w) => w.id), settings.beijingPack, settings.nextWords), { newPerDay: settings.newPerDay, reviewsPerDay: settings.reviewsPerDay, mic: micActive() }).then(setQueue);
  }, [vocab, cards, settings.newPerDay, settings.reviewsPerDay, settings.speaking, settings.beijingPack, speakPaused, game?.xp]);

  const weak = useMemo(() => weakestPair(patternStats(toneLogs)), [toneLogs]);
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;
  const nextAch = ACHIEVEMENTS.filter((a) => !game?.unlocked.has(a.id))
    .map((a) => ({ a, p: game ? a.progress(game.stats) : 0 }))
    .sort((x, y) => y.p - x.p)[0];
  const todayXp = game?.streak.todayXp ?? 0;
  const due = queue?.reviews.length ?? 0;
  const fresh = queue?.newWords.length ?? 0;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  /** "24 reviews, 3 new words and 6 tone questions": what that session will actually hold. */
  const contents = (mode: 'quick' | 'deep') => {
    if (!queue) return 'Checking what’s due…';
    const p = sessionPreview(mode, due, fresh, settings.sessionTones);
    const parts = [p.reviews ? plural(p.reviews, 'review') : '', p.newWords ? plural(p.newWords, 'new word') : '', p.tones ? plural(p.tones, 'tone question') : ''].filter(Boolean);
    if (mode === 'deep') parts.push('listening', ...(settings.speaking && micSupported ? ['speaking'] : []));
    if (!parts.length) return 'Nothing due right now';
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };

  const sessions = [
    { mode: 'quick' as const, title: 'Quick session', detail: `About 5 minutes: ${contents('quick')}.` },
    { mode: 'deep' as const, title: 'Deep session', detail: `20+ minutes: ${contents('deep')}.` },
  ];
  if (wide) sessions.reverse();
  const resumable = resume && remainingItems(resume) > 0 ? resume : null;

  return (
    <div className="pb-10">
      <InstallBanner />

      <section className="card flex items-center gap-5 p-5" aria-label="Today">
        <div className="relative" aria-label={`Daily goal: ${todayXp} of ${settings.dailyGoal} XP`}>
          <GoalRing value={todayXp} goal={settings.dailyGoal} />
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-lg font-semibold tabular-nums">{Math.min(999, todayXp)}</span>
            <span className="mt-0.5 text-[10px] text-muted">of {settings.dailyGoal}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 whitespace-nowrap text-lg font-semibold">
            <Flame className={`h-5 w-5 ${game?.streak.current ? 'text-cinnabar' : 'text-muted'}`} />
            {game?.streak.current ?? 0}-day streak
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {game?.streak.todayDone ? 'Goal reached today' : `${Math.max(0, settings.dailyGoal - todayXp)} XP to today's goal`}
            {game?.streak.freezes ? ` · ${game.streak.freezes} freeze${game.streak.freezes > 1 ? 's' : ''} saved` : ''}
          </p>
        </div>
        {game && (
          <div className="w-16 text-right">
            <p className="text-xs text-muted">Level</p>
            <p className="text-2xl font-semibold tabular-nums">{game.level.level}</p>
            <ProgressBar value={game.level.into / game.level.span} label="Progress to the next level" tone="gold" className="mt-1" />
          </div>
        )}
      </section>

      {resumable && (
        <button onClick={() => go('session/resume')} className="press card mt-3 flex w-full items-center gap-4 border-gold/40 bg-amber-soft p-4 text-left">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Resume your {resumable.plan.mode} session</span>
            <span className="block text-sm text-muted">
              {remainingItems(resumable)} questions left, {resumable.xp} XP so far
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {sessions.map((x, i) =>
          i === 0 ? (
            <button key={x.mode} onClick={() => go(`session/${x.mode}`)} className="press group flex w-full items-center gap-4 rounded-[22px] bg-jade p-6 text-left text-jade-ink shadow-md">
              <span className="min-w-0 flex-1">
                <span className="block text-[1.625rem] font-semibold leading-tight">{x.title}</span>
                <span className="mt-1 block text-[0.9375rem] opacity-85">{x.detail}</span>
              </span>
              <ChevronRight className="h-6 w-6 opacity-80 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button key={x.mode} onClick={() => go(`session/${x.mode}`)} className="press card flex w-full items-center gap-4 p-5 text-left hover:border-ink/20">
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{x.title}</span>
                <span className="block text-sm text-muted">{x.detail}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </button>
          ),
        )}
      </div>
      {settings.speaking && micSupported && (
        <p className="mt-3 text-center text-sm text-muted">
          {speakPaused > Date.now() ? (
            <>
              Speaking paused until {new Date(speakPaused).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.{' '}
              <button onClick={() => void setSpeakPausedUntil(0)} className="font-medium text-jade">
                Turn the mic back on
              </button>
            </>
          ) : (
            <button onClick={() => void setSpeakPausedUntil(Date.now() + 3600_000)} className="font-medium text-muted hover:text-ink">
              No mic right now? Skip speaking for an hour
            </button>
          )}
        </p>
      )}

      <ul className="group-list mt-6">
        <li>
          <button onClick={() => go('tone-gym')} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
            <ToneMark />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Tone Gym</span>
              <span className="block text-sm text-muted">
                {weak ? (
                  <>
                    Weakest pair this week: <span className="font-medium text-ink">{patternLabel(weak.pattern)}</span>, {Math.round(weak.error * 100)}% missed
                  </>
                ) : (
                  'Rounds of 20 tone questions'
                )}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </button>
        </li>
        {!settings.placedAt && (
          <li>
            <button onClick={() => go('placement')} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
              <span className="han flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sunk text-sm" aria-hidden>
                测
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Know some Chinese already?</span>
                <span className="block text-sm text-muted">Find your level in 5 minutes and skip the words you know</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </button>
          </li>
        )}
        {nextAch && (
          <li>
            <button onClick={() => go('progress')} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
              <span className="han flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/50 text-[11px] font-medium text-gold" aria-hidden>
                {nextAch.a.hanzi}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">Next: {nextAch.a.title}</span>
                  <span className="text-xs tabular-nums text-muted">{Math.round(nextAch.p * 100)}%</span>
                </span>
                <ProgressBar value={nextAch.p} label={`${nextAch.a.title} progress`} tone="gold" className="mt-2" />
              </span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

/** The four tone contours in their colours: the Tone Gym's mark. */
function ToneMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 rounded-xl bg-sunk p-1.5" aria-hidden>
      <path d="M6 12h6" stroke="var(--t1)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M15 24l6-11" stroke="var(--t2)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M6 22c1.5 6 4.5 6 6 1" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" fill="none" transform="translate(0 4)" />
      <path d="M26 12l7 14" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
