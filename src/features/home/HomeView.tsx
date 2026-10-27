/**
 * Home (CLAUDE.md §7): streak, daily goal ring, level, what's due, the big
 * Quick session button (phone) and Deep session (PC), resume, the weakest
 * tone pair of the week, achievements. The old course lives on as Conversations.
 */
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import { ACHIEVEMENTS } from '../../lib/gamify';
import { loadGameStats } from '../../lib/gameStats';
import { todaysQueue, type Queue } from '../../lib/review';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';
import { patternLabel, patternStats, weakestPair } from '../tonegym/model';
import { loadSession, remainingItems } from '../session/state';
import { InstallBanner } from '../settings/install';
import { Waves } from '../../components/icons';

const WEEK = 7 * 864e5;

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / Math.max(1, goal));
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunk)" strokeWidth="8" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={frac >= 1 ? 'var(--jade)' : 'var(--gold)'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

export function HomeView() {
  const settings = useSettings();
  const vocab = useVocab();
  const game = useLive(() => loadGameStats(settings.dailyGoal), [settings.dailyGoal], null);
  const resume = useLive(() => loadSession(), [], null);
  const toneLogs = useLive(() => db.reviewLogs.where('at').above(Date.now() - WEEK).filter((l) => !!l.tones && !l.replaced).toArray(), [], []);
  const cards = useLive(() => db.reviewItems.count(), [], 0);
  const [queue, setQueue] = useState<Queue | null>(null);
  useEffect(() => {
    if (!vocab) return;
    void todaysQueue(vocab.map((w) => w.id), { newPerDay: settings.newPerDay, reviewsPerDay: settings.reviewsPerDay, mic: settings.speaking }).then(setQueue);
  }, [vocab, cards, settings.newPerDay, settings.reviewsPerDay, settings.speaking, game?.xp]);

  const weak = useMemo(() => weakestPair(patternStats(toneLogs)), [toneLogs]);
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;
  const next = ACHIEVEMENTS.filter((a) => !game?.unlocked.has(a.id))
    .map((a) => ({ a, p: game ? a.progress(game.stats) : 0 }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 3);

  const quick = (
    <button key="quick" onClick={() => go('session/quick')} className={`press flex w-full flex-col items-start rounded-3xl p-5 text-left ${wide ? 'border-2 border-line bg-surface' : 'bg-jade text-jade-ink'}`}>
      <span className="text-2xl font-bold">Quick session</span>
      <span className={`text-sm ${wide ? 'text-muted' : 'opacity-90'}`}>About 5 minutes: reviews with tone questions mixed in</span>
    </button>
  );
  const deep = (
    <button key="deep" onClick={() => go('session/deep')} className={`press flex w-full flex-col items-start rounded-3xl p-5 text-left ${wide ? 'bg-jade text-jade-ink' : 'border-2 border-line bg-surface'}`}>
      <span className="text-2xl font-bold">Deep session</span>
      <span className={`text-sm ${wide ? 'opacity-90' : 'text-muted'}`}>20+ minutes: reviews, new words, listening, Tone Gym</span>
    </button>
  );

  return (
    <div className="pb-10">
      <InstallBanner />
      <section className="flex items-center gap-4 rounded-3xl bg-surface p-4" aria-label="Today">
        <div className="relative" aria-label={`Daily goal: ${game?.streak.todayXp ?? 0} of ${settings.dailyGoal} XP`}>
          <GoalRing value={game?.streak.todayXp ?? 0} goal={settings.dailyGoal} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
            {Math.min(999, game?.streak.todayXp ?? 0)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{game?.streak.todayDone ? "Today's goal: done" : `Today: ${game?.streak.todayXp ?? 0} of ${settings.dailyGoal} XP`}</p>
          <p className="text-xl font-bold">
            <span className="han mr-1 text-cinnabar" aria-hidden>
              火
            </span>
            {game?.streak.current ?? 0}-day streak
          </p>
          {!!game?.streak.freezes && (
            <p className="text-xs text-muted">
              {game.streak.freezes} streak freeze{game.streak.freezes > 1 ? 's' : ''} saved up
            </p>
          )}
        </div>
        {game && (
          <div className="text-right">
            <p className="text-xs text-muted">Level</p>
            <p className="text-3xl font-bold tabular-nums text-gold">{game.level.level}</p>
            <div className="mt-1 h-1.5 w-14 overflow-hidden rounded-full bg-sunk">
              <div className="h-full bg-gold" style={{ width: `${(game.level.into / game.level.span) * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      <p className="mt-5 text-center text-sm text-muted" aria-live="polite">
        {queue ? (
          <>
            <span className="font-semibold text-ink">{queue.reviews.length}</span> review{queue.reviews.length === 1 ? '' : 's'} due ·{' '}
            <span className="font-semibold text-ink">{queue.newWords.length}</span> new word{queue.newWords.length === 1 ? '' : 's'} today
          </>
        ) : (
          'Checking what’s due…'
        )}
      </p>

      {resume && remainingItems(resume) > 0 && (
        <button onClick={() => go('session/resume')} className="press mt-3 flex w-full items-center justify-between rounded-2xl bg-amber-soft p-4 text-left">
          <span>
            <span className="block font-semibold">Resume your {resume.plan.mode} session</span>
            <span className="block text-sm text-muted">{remainingItems(resume)} questions left · {resume.xp} XP so far</span>
          </span>
          <span className="text-2xl" aria-hidden>
            ›
          </span>
        </button>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">{wide ? [deep, quick] : [quick, deep]}</div>

      <button onClick={() => go('tone-gym')} className="mt-3 flex w-full items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 text-left hover:border-jade">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cinnabar/10 text-cinnabar" aria-hidden>
          <Waves className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Tone Gym</span>
          <span className="block text-sm text-muted">
            {weak ? (
              <>
                Weakest pair this week: <span className="font-semibold text-ink">{patternLabel(weak.pattern)}</span> ({Math.round(weak.error * 100)}% missed)
              </>
            ) : (
              '20 quick tone questions'
            )}
          </span>
        </span>
      </button>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Achievements</h2>
          <span className="text-sm tabular-nums text-muted">
            {game?.unlocked.size ?? 0} of {ACHIEVEMENTS.length}
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {next.map(({ a, p }) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="han flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunk text-xs font-bold text-muted">{a.hanzi}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunk">
                  <span className="block h-full bg-gold" style={{ width: `${p * 100}%` }} />
                </span>
              </span>
              <span className="text-xs tabular-nums text-muted">{Math.round(p * 100)}%</span>
            </li>
          ))}
        </ul>
        {game && game.unlocked.size > 0 && (
          <p className="mt-3 flex flex-wrap gap-2">
            {ACHIEVEMENTS.filter((a) => game.unlocked.has(a.id)).map((a) => (
              <span key={a.id} title={`${a.title}: ${a.detail}`} className="han flex h-10 w-10 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">
                {a.hanzi}
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <button onClick={() => go('conversations')} className="rounded-2xl border-2 border-line bg-surface p-4 text-left hover:border-jade">
          <span className="block font-semibold">Conversations</span>
          <span className="block text-sm text-muted">The original units: dialogues, role-play, everyday phrases</span>
        </button>
        <button onClick={() => go('read')} className="rounded-2xl border-2 border-line bg-surface p-4 text-left hover:border-jade">
          <span className="block font-semibold">Read</span>
          <span className="block text-sm text-muted">Short stories with the words you know</span>
        </button>
      </section>
    </div>
  );
}
