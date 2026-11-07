/**
 * Home (CLAUDE.md §7). One plate, one button, one next step:
 * - the **Today plate**: streak (a big numeral), today's goal ring, one level line, and the main
 *   session button inside it (Quick on a phone, Deep on a PC; the other one sits under it);
 * - quiet rows below: the other session, Tone Gym with your weakest pair, placement, the next badge;
 * - on PC (lg) a third column, **This week**: weakest pair, accuracy per tone, retention and the
 *   reviews coming up, so the numbers are there before you start;
 * - a brand-new account gets a welcome plate instead of a row of zeros.
 */
import { sessionPreview } from '../session/plan';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { forecast, retention, toneAccuracy } from '../../lib/statsData';
import { patternLabel, patternStats, weakestPair } from '../tonegym/model';
import { loadSession, remainingItems } from '../session/state';
import { InstallBanner } from '../settings/install';
import { ChevronRight, Flame } from '../../components/icons';
import { PatternContour, ToneContour } from '../../components/ToneContour';
import { ProgressBar } from '../../components/ProgressBar';

const WEEK = 7 * 864e5;
const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4'];

/** Today's XP against the goal, drawn on the plate (light strokes on jade). */
function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / Math.max(1, goal));
  return (
    <div className="relative h-[92px] w-[92px] shrink-0" aria-label={`Daily goal: ${value} of ${goal} XP`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="num text-2xl">{Math.min(999, value)}</span>
        <span className="mt-1 text-xs opacity-80">of {goal}</span>
      </span>
    </div>
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
  /** "24 reviews · 3 new words · 6 tone questions": what that session will actually hold. */
  const contents = (mode: 'quick' | 'deep') => {
    if (!queue) return 'Checking what’s due…';
    const p = sessionPreview(mode, due, fresh, settings.sessionTones);
    const parts = [p.reviews ? plural(p.reviews, 'review') : '', p.newWords ? plural(p.newWords, 'new word') : '', p.tones ? plural(p.tones, 'tone question') : ''].filter(Boolean);
    if (mode === 'deep') parts.push('listening', ...(settings.speaking && micSupported ? ['speaking'] : []));
    if (!parts.length) return 'Nothing due right now';
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };
  const sessions = [
    { mode: 'quick' as const, title: 'Quick session', time: 'About 5 min', detail: contents('quick') },
    { mode: 'deep' as const, title: 'Deep session', time: '20+ min', detail: contents('deep') },
  ];
  // Phones lead with Quick, PCs with Deep (CLAUDE.md §7).
  if (wide) sessions.reverse();
  const [main, other] = sessions;
  const resumable = resume && remainingItems(resume) > 0 ? resume : null;
  // A brand-new account: nothing studied yet.
  const fresh0 = !!game && game.xp === 0 && cards === 0 && !resumable;

  const micLink = settings.speaking && micSupported && (
    <p className="mt-2 text-center text-sm text-muted">
      {speakPaused > Date.now() ? (
        <>
          Speaking paused until {new Date(speakPaused).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.{' '}
          <button onClick={() => void setSpeakPausedUntil(0)} className="inline-flex min-h-11 items-center px-1 font-medium text-jade">
            Turn the mic back on
          </button>
        </>
      ) : (
        <button onClick={() => void setSpeakPausedUntil(Date.now() + 3600_000)} className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-muted hover:text-ink">
          No mic right now? Skip speaking for an hour
        </button>
      )}
    </p>
  );

  return (
    <div className="pb-10">
      <InstallBanner />

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="lg:col-span-2">
          {fresh0 ? (
            <Welcome />
          ) : (
            <section className="rounded-plate bg-plate p-5 text-plate-ink shadow-md dark:border dark:border-jade/40 md:p-6" aria-label="Today">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-end gap-2">
                    <span className="num text-numeral-xl">{game?.streak.current ?? 0}</span>
                    <span className="mb-1.5 flex items-center gap-1 text-lg font-semibold leading-tight">
                      <Flame className={`h-5 w-5 ${game?.streak.current ? '' : 'opacity-60'}`} />
                      day streak
                    </span>
                  </p>
                  <p className="mt-1 text-sm opacity-85">
                    {game?.streak.todayDone ? 'Goal reached today' : `${Math.max(0, settings.dailyGoal - todayXp)} XP to today's goal`}
                    {game?.streak.freezes ? `. ${game.streak.freezes} streak freeze${game.streak.freezes > 1 ? 's' : ''} saved.` : ''}
                  </p>
                </div>
                <GoalRing value={todayXp} goal={settings.dailyGoal} />
              </div>
              {game && (
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <span className="shrink-0 font-semibold">Level {game.level.level}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-plate-ink/20" role="progressbar" aria-label="Progress to the next level" aria-valuenow={Math.round((game.level.into / game.level.span) * 100)} aria-valuemax={100}>
                    <span className="block h-full rounded-full bg-plate-ink" style={{ width: `${(game.level.into / game.level.span) * 100}%` }} />
                  </span>
                  <span className="shrink-0 tabular-nums opacity-85">
                    {game.level.span - game.level.into} XP to {game.level.level + 1}
                  </span>
                </div>
              )}

              {resumable ? (
                <button onClick={() => go('session/resume')} className="press mt-5 flex w-full items-center gap-4 rounded-control bg-plate-ink p-4 text-left text-plate">
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">Resume your {resumable.plan.mode} session</span>
                    <span className="block text-sm opacity-80">
                      {remainingItems(resumable)} questions left, {resumable.xp} XP so far
                    </span>
                  </span>
                  <ChevronRight className="h-6 w-6" />
                </button>
              ) : (
                <button onClick={() => go(`session/${main.mode}`)} className="press group mt-5 flex w-full items-center gap-4 rounded-control bg-plate-ink p-4 text-left text-plate md:p-5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-title font-semibold">{main.title}</span>
                      <span className="shrink-0 text-sm font-medium opacity-80">{main.time}</span>
                    </span>
                    <span className="mt-0.5 block text-sm opacity-80">{main.detail}</span>
                  </span>
                  <ChevronRight className="h-6 w-6 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              )}
            </section>
          )}

          <ul className="group-list mt-4">
            {fresh0 ? null : (
              <Row onClick={() => go(`session/${other.mode}`)} title={other.title} sub={`${other.time}: ${other.detail}`} mark={<span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-sunk text-base" aria-hidden>{other.mode === 'deep' ? '20' : '5'}</span>} />
            )}
            <Row
              onClick={() => go('tone-gym')}
              title="Tone Gym"
              mark={<ToneMark />}
              sub={
                weak ? (
                  <>
                    Weakest pair this week: <span className="font-semibold text-ink">{patternLabel(weak.pattern)}</span> <PatternContour pattern={weak.pattern} className="h-2.5 w-4 text-ink" />, missed {Math.round(weak.error * 100)}%
                  </>
                ) : (
                  'Rounds of 20, six real voices'
                )
              }
            />
            {!settings.placedAt && !fresh0 && (
              <Row
                onClick={() => go('placement')}
                title="Know some Chinese already?"
                sub="Find your level in 5 minutes and skip the words you know"
                mark={
                  <span className="han flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-sunk text-sm" aria-hidden>
                    测
                  </span>
                }
              />
            )}
            {nextAch && !fresh0 && (
              <li>
                <button onClick={() => go('progress')} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
                  <span className="han flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-imperial text-xs font-semibold text-imperial" aria-hidden>
                    {nextAch.a.hanzi}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">Next badge: {nextAch.a.title}</span>
                      <span className="text-sm tabular-nums text-muted">{Math.round(nextAch.p * 100)}%</span>
                    </span>
                    <ProgressBar value={nextAch.p} label={`${nextAch.a.title} progress`} tone="imperial" className="mt-2" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </button>
              </li>
            )}
          </ul>
          {micLink}
        </div>

        {wide && !fresh0 && <ThisWeek weak={weak} toneLogs={toneLogs} />}
      </div>
    </div>
  );
}

function Row({ onClick, title, sub, mark }: { onClick: () => void; title: string; sub: ReactNode; mark: ReactNode }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
        {mark}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted">{sub}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </button>
    </li>
  );
}

/** The first day: the four tone contours, what the app is, and two ways in. */
function Welcome() {
  return (
    <section className="rounded-plate bg-plate p-6 text-plate-ink shadow-md dark:border dark:border-jade/40" aria-label="Welcome">
      <div className="flex justify-around rounded-control bg-surface px-4 py-3" aria-hidden>
        {[1, 2, 3, 4].map((t) => (
          <ToneContour key={t} tone={t} className={`h-6 w-10 ${TONE_TEXT[t]}`} />
        ))}
      </div>
      <h1 className="mt-5 text-heading font-semibold">Mandarin by ear. Tones first.</h1>
      <p className="mt-2 opacity-85">Short sessions of listening and typing pinyin, with real voices for every tone. Your streak, level and tone mix-ups build up as you go.</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button onClick={() => go('session/quick')} className="press flex-1 rounded-control bg-plate-ink px-5 py-4 text-lg font-semibold text-plate">
          Start with HSK 1
        </button>
        <button onClick={() => go('placement')} className="press flex-1 rounded-control border border-plate-ink/50 px-5 py-4 font-semibold">
          I know some already: find my level
        </button>
      </div>
    </section>
  );
}

/** PC: the numbers before you start. Weakest pair, accuracy per tone, retention, reviews coming up. */
function ThisWeek({ weak, toneLogs }: { weak: ReturnType<typeof weakestPair>; toneLogs: Parameters<typeof toneAccuracy>[0] }) {
  const now = Date.now();
  const logs = useLive(() => db.reviewLogs.where('at').above(now - 30 * 864e5).toArray(), [], []);
  const items = useLive(() => db.reviewItems.toArray(), [], []);
  const tones = useMemo(() => toneAccuracy(toneLogs).filter((t) => t.tone <= 4), [toneLogs]);
  const kept = useMemo(() => retention(logs, now, 30), [logs, now]);
  const coming = useMemo(() => forecast(items, now, micActive(), 14), [items, now]);
  // Square-root scale, so a backlog today doesn't flatten the rest of the fortnight.
  const peak = Math.sqrt(Math.max(1, ...coming.map((d) => d.count)));
  return (
    <aside className="card mt-6 p-5 lg:mt-0" aria-label="This week">
      <h2 className="text-lg font-semibold">This week</h2>
      {weak ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Weakest tone pair</p>
          <p className="mt-1 flex items-center gap-3">
            <span className="num text-numeral leading-none">{patternLabel(weak.pattern)}</span>
            <PatternContour pattern={weak.pattern} className="h-4 w-7 text-ink" />
          </p>
          <p className="text-sm text-muted">missed {Math.round(weak.error * 100)}% of the time</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Answer some tone questions to see your weakest pair.</p>
      )}
      <ul className="mt-5 flex flex-col gap-2">
        {tones.map((t) => (
          <li key={t.tone} className="flex items-center gap-3 text-sm">
            <span className={`flex w-12 items-center gap-1 font-semibold ${TONE_TEXT[t.tone]}`}>
              <ToneContour tone={t.tone} className="h-2.5 w-5" />
              {t.tone}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
              <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(t.rate ?? 0) * 100}%` }} />
            </span>
            <span className="w-10 text-right tabular-nums">{t.rate === null ? '–' : `${Math.round(t.rate * 100)}%`}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
        <div>
          <p className="text-sm text-muted">Kept (30 days)</p>
          <p className="num text-4xl">{kept.rate === null ? '–' : `${Math.round(kept.rate * 100)}%`}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-right text-sm text-muted">Reviews, next 14 days</p>
          <div className="mt-1 flex h-12 items-end gap-[3px]" role="img" aria-label={`Reviews coming up: ${coming.map((d) => d.count).join(', ')}`}>
            {coming.map((d) => (
              <span key={d.day} className="flex-1 rounded-t-sm bg-jade/70" style={{ height: `${Math.max(6, (Math.sqrt(d.count) / peak) * 100)}%` }} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The four tone contours in their colours: the Tone Gym's mark. */
function ToneMark() {
  return (
    <span className="grid h-10 w-10 shrink-0 grid-cols-2 place-items-center gap-0.5 rounded-control bg-sunk p-1.5" aria-hidden>
      {[1, 2, 3, 4].map((t) => (
        <ToneContour key={t} tone={t} className={`h-2 w-3.5 ${TONE_TEXT[t]}`} />
      ))}
    </span>
  );
}
