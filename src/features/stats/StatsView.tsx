/**
 * Stats (CLAUDE.md §2): words by state per HSK level, true retention vs
 * target, the 14-day forecast, the tone confusion matrix, time per day,
 * accuracy trend and XP history.
 */
import { PageHeader } from '../../components/PageHeader';
import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useGameStats } from '../../lib/gameStats';
import { ACHIEVEMENTS, closestAchievements } from '../../lib/gamify';
import { ProgressBar } from '../../components/ProgressBar';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { forecast, OPTIMISE_AFTER, optimiserReviews, perDay, retention, STATES, toneAccuracy, wordsByLevel } from '../../lib/statsData';
import { useLive } from '../../lib/useLive';
import { meaningOf, useVocab, type VocabRow } from '../../lib/vocabData';
import { twinIndexFor, twinPairs } from '../../lib/toneTwins';
import { play } from '../../lib/audio';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { TONE_WORD } from '../tonegym/model';
import { ToneMatrix } from '../tonegym/ToneMatrix';
import { ToneContour } from '../../components/ToneContour';
import { Columns, Legend, StackBar, TableView, Tile } from './charts';
import { ReviewCards } from '../progress/ReviewCards';
import { StudyCalendar } from './StudyCalendar';
import { PaceForecast } from './PaceForecast';
import { readingByLevel, readingStates } from '../../lib/reading';
import { useReadData } from '../reading/data';
import type { ReviewItemRow, ReviewLogRow } from '../../db/db';

/** Words by state: one hue (jade), light to dark as a word settles. */
const STATE_COLOR: Record<string, string> = {
  new: 'color-mix(in oklab, var(--muted) 28%, var(--surface))',
  learning: 'color-mix(in oklab, var(--jade) 35%, var(--surface))',
  young: 'color-mix(in oklab, var(--jade) 65%, var(--surface))',
  mature: 'var(--jade)',
};
const STATE_LABEL: Record<string, string> = { new: 'New', learning: 'Learning', young: 'Young (under 21 days)', mature: 'Mature (21+ days)' };
const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const dayLabel = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const weekday = (t: number, i: number) => (i === 0 ? 'Now' : new Date(t).toLocaleDateString('en-GB', { weekday: 'narrow' }));
/** Axis label: day and month, e.g. "2 Nov" (only every 7th day is labelled). */
const dom = dayLabel;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="text-lg font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-sm leading-snug text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TABS = [
  ['overview', 'Overview'],
  ['words', 'Words'],
  ['tones', 'Tones'],
  ['habits', 'Habits'],
  ['badges', 'Badges'],
] as const;
type Tab = (typeof TABS)[number][0];
const TAB_KEY = 'stats-tab';
function savedTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some(([id]) => id === t) ? (t as Tab) : 'overview';
  } catch {
    return 'overview';
  }
}

/** One panel's sections; side by side on a wide screen. */
function Panel({ id, children }: { id: Tab; children: React.ReactNode }) {
  return (
    <div id={`stats-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className="anim-fade lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 [&>section:first-child]:mt-6 lg:[&>section:nth-child(2)]:mt-6">
      {children}
    </div>
  );
}

/** Sticky segmented tabs: one panel at a time instead of one long page. */
function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mt-8 bg-bg/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
      <div role="tablist" aria-label="Stats" className="flex gap-1 overflow-x-auto rounded-control bg-sunk p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`stats-${id}`}
            onClick={() => onTab(id)}
            className={`h-10 min-w-[4.5rem] flex-1 shrink-0 rounded-[9px] px-3 text-sm font-semibold transition-colors ${tab === id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The lead numbers: condensed, side by side. */
function Lead({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-1 py-2 sm:px-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="num mt-1 text-5xl leading-none">{value}</p>
      {note && <p className="mt-1.5 text-sm text-muted">{note}</p>}
    </div>
  );
}

export function StatsView() {
  const settings = useSettings();
  const vocab = useVocab();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const logs = useLive(() => db.reviewLogs.toArray(), [], null);
  const game = useGameStats(settings.dailyGoal);
  const [allAch, setAllAch] = useState(false);
  const [tab, setTab] = useState<Tab>(savedTab);
  const now = useMemo(() => Date.now(), [logs]);

  const levels = useMemo(() => (vocab && cards ? wordsByLevel(vocab, cards) : null), [vocab, cards]);
  const days = useMemo(() => (logs ? perDay(logs, now, 30) : []), [logs, now]);
  const fc = useMemo(() => (cards ? forecast(cards, now, settings.speaking) : []), [cards, now, settings.speaking]);
  const toneLogs = useMemo(() => (logs ?? []).filter((l) => l.tones && !l.replaced), [logs]);
  if (!logs || !cards) return <p className="p-8 text-center text-muted">Loading…</p>;

  const r30 = retention(logs, now, 30);
  const target = settings.retention;
  const started = levels?.reduce((n, l) => n + l.total - l.counts.new, 0) ?? 0;
  const mature = levels?.reduce((n, l) => n + l.counts.mature, 0) ?? 0;
  const tones = toneAccuracy(logs);
  const fsrsReviews = optimiserReviews(logs);
  const minutes30 = days.reduce((n, d) => n + d.minutes, 0);

  const fresh = logs.length === 0 && cards.length === 0;
  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* private mode: the tab just isn't remembered */
    }
  };
  const startedLevels = levels?.filter((l) => l.total - l.counts.new > 0) ?? [];
  const idleLevels = levels?.filter((l) => l.total - l.counts.new === 0) ?? [];
  const lvlName = (n: number) => (n === 7 ? '7–9' : String(n));

  return (
    <div className="pb-10">
      <PageHeader title="Stats" />

      <section className="card mt-4 grid grid-cols-2 gap-y-3 p-4 sm:grid-cols-4 sm:divide-x sm:divide-line md:p-5" aria-label="Lead numbers">
        <Lead label="Words started" value={fresh ? '–' : started.toLocaleString('en-GB')} note={fresh ? undefined : `${mature.toLocaleString('en-GB')} mature`} />
        <Lead label="Kept, 30 days" value={pct(r30.rate)} note={r30.n ? `target ${pct(target)}` : fresh ? undefined : 'after your first long-term reviews'} />
        <Lead label="Streak" value={fresh ? '–' : String(game?.streak.current ?? 0)} note={game && !fresh ? `best ${game.streak.best} days` : undefined} />
        <Lead label="Level" value={fresh ? '–' : String(game?.level.level ?? 1)} note={game && !fresh ? `${game.xp.toLocaleString('en-GB')} XP` : undefined} />
      </section>
      {fresh ? (
        <div className="card mt-4 p-5 [&_.btn]:mr-2">
          <p className="font-semibold">Your numbers appear after your first session.</p>
          <p className="mt-1 text-sm text-muted">Words, retention, your streak and the tone matrix all fill in from your answers.</p>
          <button onClick={() => go('session/quick')} className="btn btn-primary mt-4 h-12 px-5 text-base">
            Start a quick session
          </button>
          <button onClick={() => go('words')} className="btn btn-quiet mt-4 h-12 px-5 text-base">
            Browse the words
          </button>
        </div>
      ) : (
        <>
          {r30.rate !== null && r30.n >= 20 && (
            <p className="mt-3 text-sm text-muted">
              {r30.rate < target - 0.03
                ? `Retention is below your ${pct(target)} target: reviews are coming back a little too late for you, which the scheduler optimiser will be able to correct.`
                : r30.rate > target + 0.03
                  ? `Retention is above your ${pct(target)} target: you could lower the target in Settings to get fewer reviews.`
                  : `Right on your ${pct(target)} target (${r30.n} reviews in 30 days).`}
            </p>
          )}

          <section className="card mt-4 p-4 md:p-5" aria-label="Tone matrix">
            <h2 className="text-title font-semibold">Tone matrix</h2>
            <p className="mt-0.5 text-sm text-muted">Rows: the tone it really was. Columns: what you heard or typed.</p>
            <div className="mt-3">
              <ToneMatrix logs={toneLogs} />
            </div>
          </section>

          <TabBar tab={tab} onTab={pick} />

          {tab === 'overview' && (
            <Panel id="overview">
              <section className="mt-6">
                <PaceForecast logs={logs} now={now} mature={mature} levels={levels} game={game} />
              </section>
            <Section title="Reviews coming up" note="Cards due each day for the next two weeks. Today includes anything overdue.">
              <Columns
                caption="Reviews due per day, next 14 days"
                data={fc.map((d, i) => ({ key: d.day, label: weekday(d.day, i), value: d.count, detail: `${i === 0 ? 'Today' : dayLabel(d.day)}: ${d.count} due` }))}
                labelEvery={1}
              />
            </Section>


            </Panel>
          )}

          {tab === 'words' && (
            <Panel id="words">
            <Section title="Words by HSK level" note="A word counts as far as its weakest skill (listening or typing). Mature: next review 21 or more days away.">
              <Legend items={STATES.map((s) => ({ label: STATE_LABEL[s], color: STATE_COLOR[s] }))} />
              <ul className="mt-3 flex flex-col gap-3">
                {startedLevels.map((l) => (
                  <li key={l.level}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium">{l.level === 7 ? 'HSK 7–9' : `HSK ${l.level}`}</span>
                      <span className="tabular-nums text-muted">
                        {(l.total - l.counts.new).toLocaleString('en-GB')} / {l.total.toLocaleString('en-GB')} started · {l.counts.mature} mature
                      </span>
                    </div>
                    <StackBar
                      total={l.total}
                      label={`HSK ${l.level}: ${STATES.map((s) => `${l.counts[s]} ${s}`).join(', ')}`}
                      segments={(['mature', 'young', 'learning', 'new'] as const).map((s) => ({ key: s, value: l.counts[s], color: STATE_COLOR[s], label: STATE_LABEL[s] }))}
                    />
                  </li>
                ))}
              </ul>
              {idleLevels.length > 0 && (
                <p className="mt-3 text-sm text-muted">
                  HSK {lvlName(idleLevels[0].level)}
                  {idleLevels.length > 1 ? ` to ${lvlName(idleLevels[idleLevels.length - 1].level)}` : ''}: not started yet.
                </p>
              )}
              {levels && (
                <TableView
                  caption="Words by HSK level and state"
                  head={['Level', 'New', 'Learning', 'Young', 'Mature']}
                  rows={levels.map((l) => [l.level === 7 ? '7–9' : String(l.level), l.counts.new, l.counts.learning, l.counts.young, l.counts.mature])}
                />
              )}
              <button onClick={() => go('words')} className="mt-3 h-11 w-full rounded-2xl border border-line font-medium">
                Browse the words
              </button>
            </Section>


              <ReviewCards />
              <ReadingStats cards={cards} logs={logs} />
            </Panel>
          )}

          {tab === 'tones' && (
            <Panel id="tones">
              <Section title="Accuracy per tone" note="From the Tone Gym, tone exercises and every typed answer.">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {tones
                    .filter((t) => t.tone <= 4)
                    .map((t) => (
                      <div key={t.tone} className="rounded-control border border-line bg-surface p-2">
                        <p className={`flex items-center justify-center gap-1 text-sm font-semibold ${TONE_TEXT[t.tone]}`}>
                          <ToneContour tone={t.tone} className="h-2.5 w-5" />
                          {TONE_WORD[t.tone]}
                        </p>
                        <p className="num mt-1 text-3xl">{pct(t.rate)}</p>
                        <p className="text-sm text-muted">{t.n} heard</p>
                      </div>
                    ))}
                </div>
              </Section>
              <ToneTwins vocab={vocab} logs={toneLogs} hanzi={settings.showHanzi} />
            </Panel>
          )}

          {tab === 'habits' && (
            <Panel id="habits">
            <Section title="Study calendar" note={`Each square is a day, shaded by how much of your ${settings.dailyGoal} XP goal you reached. Tap a day for details.`}>
              <StudyCalendar logs={logs} goal={settings.dailyGoal} streak={game?.streak ?? null} now={now} />
            </Section>

            <Section title="Time studied" note={`Minutes answering per day, last 30 days: ${minutes30} in all.`}>
              <Columns
                caption="Minutes studied per day, last 30 days"
                color="var(--jade)"
                labelEvery={7}
                data={days.map((d) => ({ key: d.day, label: dom(d.day), value: d.minutes, detail: `${dayLabel(d.day)}: ${d.minutes} min, ${d.answers} answers` }))}
              />
            </Section>

            <Section title="Accuracy" note="Share of answers right (or nearly right) per day, last 30 days.">
              <Columns
                caption="Accuracy per day, last 30 days"
                color="var(--jade)"
                labelEvery={7}
                format={(v) => `${v}%`}
                data={days.map((d) => ({
                  key: d.day,
                  label: dom(d.day),
                  value: d.accuracy === null ? 0 : Math.round(d.accuracy * 100),
                  detail: `${dayLabel(d.day)}: ${d.accuracy === null ? 'no answers' : `${pct(d.accuracy)} of ${d.answers}`}`,
                }))}
              />
            </Section>

            <Section title="XP" note={`Per day, last 30 days. Daily goal ${settings.dailyGoal} XP.`}>
              <Columns
                caption="XP per day, last 30 days"
                color="var(--imperial)"
                labelEvery={7}
                data={days.map((d) => ({ key: d.day, label: dom(d.day), value: d.xp, detail: `${dayLabel(d.day)}: ${d.xp} XP${d.xp >= settings.dailyGoal ? ' · goal met' : ''}` }))}
              />
            </Section>


            </Panel>
          )}

          {tab === 'badges' && (
            <Panel id="badges">
            <Section title="Achievements" note={`${game?.unlocked.size ?? 0} of ${ACHIEVEMENTS.length} unlocked.${allAch ? '' : ' Closest to done:'}`}>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(allAch ? ACHIEVEMENTS : closestAchievements(game?.stats ?? null, game?.unlocked ?? new Set<string>(), 4)).map((a) => {
                  const at = game?.unlocked.get(a.id);
                  const p = game ? a.progress(game.stats) : 0;
                  return (
                    <li key={a.id} className={`card flex items-center gap-3 p-3 ${at ? '' : 'shadow-none'}`}>
                      <span
                        className={`han flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-medium ${at ? 'border-[1.5px] border-imperial bg-imperial-soft text-imperial' : 'border border-line text-muted'}`}
                        aria-hidden
                      >
                        {a.hanzi}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{a.title}</span>
                          <span className="text-xs tabular-nums text-muted">{at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : `${Math.round(p * 100)}%`}</span>
                        </span>
                        <span className="block text-xs text-muted">{a.detail}</span>
                        {!at && <ProgressBar value={p} label={`${a.title} progress`} tone="imperial" className="mt-1.5" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button onClick={() => setAllAch(!allAch)} aria-expanded={allAch} className="mt-3 h-11 w-full rounded-2xl border border-line font-medium">
                {allAch ? 'Show fewer' : `Show all ${ACHIEVEMENTS.length}`}
              </button>
            </Section>

            <Section title="Scheduler" note="FSRS learns how fast you forget once it has enough of your reviews; it then fits its parameters to you.">
              <div className="card p-4">
                <div className="flex justify-between text-sm">
                  <span>Reviews with full data</span>
                  <span className="tabular-nums">
                    {Math.min(fsrsReviews, OPTIMISE_AFTER).toLocaleString('en-GB')} / {OPTIMISE_AFTER.toLocaleString('en-GB')}
                  </span>
                </div>
                <ProgressBar value={fsrsReviews / OPTIMISE_AFTER} label="Reviews towards the scheduler optimiser" className="mt-2" />
                <p className="mt-2 text-xs text-muted">"Optimise my scheduler" appears here at {OPTIMISE_AFTER.toLocaleString('en-GB')} reviews.</p>
              </div>
            </Section>


            </Panel>
          )}
        </>
      )}
    </div>
  );
}

type LevelRows = ReturnType<typeof readingByLevel>['words'];

function LevelBars({ rows, noun }: { rows: LevelRows; noun: string }) {
  return (
    <>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((l) => (
          <li key={l.level}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{l.level === 7 ? 'HSK 7–9' : `HSK ${l.level}`}</span>
              <span className="tabular-nums text-muted">
                {(l.counts.young + l.counts.mature).toLocaleString('en-GB')} / {l.total.toLocaleString('en-GB')} readable · {l.counts.mature} mature
              </span>
            </div>
            <StackBar
              total={l.total}
              label={`${noun}, HSK ${l.level}: ${STATES.map((s) => `${l.counts[s]} ${s}`).join(', ')}`}
              segments={(['mature', 'young', 'learning', 'new'] as const).map((s) => ({ key: s, value: l.counts[s], color: STATE_COLOR[s], label: STATE_LABEL[s] }))}
            />
          </li>
        ))}
      </ul>
      <TableView
        caption={`${noun} by HSK level and reading stage`}
        head={['Level', 'New', 'Learning', 'Young', 'Mature']}
        rows={rows.map((l) => [l.level === 7 ? '7–9' : String(l.level), l.counts.new, l.counts.learning, l.counts.young, l.counts.mature])}
      />
    </>
  );
}

/** Reading: its own stage per word and character (it never changes the word stage above), retention and forecast. */
function ReadingStats({ cards, logs }: { cards: ReviewItemRow[]; logs: ReviewLogRow[] }) {
  const settings = useSettings();
  const d = useReadData();
  const now = useMemo(() => Date.now(), [logs]);
  const states = useMemo(() => readingStates(cards), [cards]);
  const rows = useMemo(() => (d ? readingByLevel(d.index, d.vocab.words, states) : null), [d, states]);
  const fc = useMemo(() => forecast(cards, now, true, 14, true), [cards, now]);
  if (!rows) return null;
  const r30 = retention(logs, now, 30, true);
  const started = states.size;
  return (
    <Section title="Reading" note="Reading characters has its own stage: a word you know by ear stays known above, however far its reading is. Readable: young or mature.">
      {started === 0 ? (
        <p className="text-sm text-muted">
          Nothing read yet.{' '}
          <button onClick={() => go('reading')} className="underline underline-offset-2">
            Open Reading
          </button>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Reading retention, 30 days" value={pct(r30.rate)} note={r30.n ? `${r30.n} reviews · target ${pct(settings.retention)}` : 'No long-term reviews yet'} />
            <Tile label="Started reading" value={started.toLocaleString('en-GB')} note="words and characters" />
          </div>
          <h4 className="mt-5 font-semibold">Words</h4>
          <Legend items={STATES.map((s) => ({ label: STATE_LABEL[s], color: STATE_COLOR[s] }))} />
          <LevelBars rows={rows.words} noun="Words" />
          <h4 className="mt-6 font-semibold">Characters</h4>
          <p className="text-sm text-muted">Each character counted once, at the first HSK level it appears in.</p>
          <LevelBars rows={rows.chars} noun="Characters" />
          <h4 className="mt-6 font-semibold">Reading reviews coming up</h4>
          <Columns
            caption="Reading reviews due per day, next 14 days"
            data={fc.map((x, i) => ({ key: x.day, label: weekday(x.day, i), value: x.count, detail: `${i === 0 ? 'Today' : dayLabel(x.day)}: ${x.count} due` }))}
            labelEvery={1}
          />
        </>
      )}
    </Section>
  );
}

/** Tone twins (IDEAS #3): words you typed with tones that spell another HSK word, most often first. */
function ToneTwins({ vocab, logs, hanzi }: { vocab: VocabRow[] | null; logs: ReviewLogRow[]; hanzi: boolean }) {
  const pairs = useMemo(() => (vocab ? twinPairs(logs, new Map(vocab.map((w) => [w.id, w])), twinIndexFor(vocab)).slice(0, 8) : []), [vocab, logs]);
  const Word = ({ w }: { w: VocabRow }) => (
    <button onClick={() => void play(w.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-sunk/60" aria-label={`Play ${w.pinyin}`}>
      <Speaker className="h-4 w-4 shrink-0 text-muted" />
      <span className="min-w-0">
        <TonePinyin pinyin={w.pinyin} className="font-semibold" />
        {hanzi && (
          <span className="han ml-1 text-muted" lang="zh-CN">
            {w.hanzi}
          </span>
        )}
        <span className="block truncate text-xs text-muted">{meaningOf(w)}</span>
      </span>
    </button>
  );
  return (
    <Section title="Tone twins" note="Words whose tones you swapped into another real word. Tap to hear each.">
      {pairs.length ? (
        <ul className="group-list">
          {pairs.map((p) => (
            <li key={`${p.word.id}|${p.twin.id}`} className="flex items-center gap-1 px-2 py-1.5">
              <Word w={p.word as VocabRow} />
              <span className="text-muted" aria-label="mixed up with">
                ↔
              </span>
              <Word w={p.twin as VocabRow} />
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted">{p.count}×</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-4 text-sm text-muted">None yet.</p>
      )}
    </Section>
  );
}
