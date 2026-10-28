/**
 * Stats (CLAUDE.md §2): words by state per HSK level, true retention vs
 * target, the 14-day forecast, the tone confusion matrix, time per day,
 * accuracy trend and XP history.
 */
import { PageHeader } from '../../components/PageHeader';
import { useMemo } from 'react';
import { db } from '../../db/db';
import { loadGameStats } from '../../lib/gameStats';
import { ACHIEVEMENTS } from '../../lib/gamify';
import { ProgressBar } from '../../components/ProgressBar';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { forecast, OPTIMISE_AFTER, optimiserReviews, perDay, retention, STATES, toneAccuracy, wordsByLevel } from '../../lib/statsData';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';
import { TONE_WORD } from '../tonegym/model';
import { ToneMatrix } from '../tonegym/ToneMatrix';
import { Columns, Legend, StackBar, TableView, Tile } from './charts';
import { ReviewCards } from '../progress/ReviewCards';

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
/** Axis label: the day of the month (the tooltip has the full date). */
const dom = (t: number) => String(new Date(t).getDate());

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-sm leading-snug text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function StatsView() {
  const settings = useSettings();
  const vocab = useVocab();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const logs = useLive(() => db.reviewLogs.toArray(), [], null);
  const game = useLive(() => loadGameStats(settings.dailyGoal), [settings.dailyGoal], null);
  const now = useMemo(() => Date.now(), [logs]);

  const levels = useMemo(() => (vocab && cards ? wordsByLevel(vocab, cards) : null), [vocab, cards]);
  const days = useMemo(() => (logs ? perDay(logs, now, 30) : []), [logs, now]);
  const fc = useMemo(() => (cards ? forecast(cards, now, settings.speaking) : []), [cards, now, settings.speaking]);
  const toneLogs = useMemo(() => (logs ?? []).filter((l) => l.tones && !l.replaced), [logs]);
  if (!logs || !cards) return <p className="p-8 text-center text-muted">Loading…</p>;

  const r7 = retention(logs, now, 7);
  const r30 = retention(logs, now, 30);
  const target = settings.retention;
  const started = levels?.reduce((n, l) => n + l.total - l.counts.new, 0) ?? 0;
  const mature = levels?.reduce((n, l) => n + l.counts.mature, 0) ?? 0;
  const tones = toneAccuracy(logs);
  const fsrsReviews = optimiserReviews(logs);
  const minutes30 = days.reduce((n, d) => n + d.minutes, 0);

  return (
    <div className="pb-10">
      <PageHeader title="Stats" />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Words started" value={started.toLocaleString('en-GB')} note={`${mature.toLocaleString('en-GB')} mature`} />
        <Tile label="Retention, 7 days" value={pct(r7.rate)} note={r7.n ? `${r7.n} reviews · target ${pct(target)}` : 'No long-term reviews yet'} />
        <Tile label="Retention, 30 days" value={pct(r30.rate)} note={r30.n ? `${r30.n} reviews · target ${pct(target)}` : 'No long-term reviews yet'} />
        <Tile label="XP" value={(game?.xp ?? 0).toLocaleString('en-GB')} note={game ? `Level ${game.level.level} · best streak ${game.streak.best}` : undefined} />
      </div>
      {r30.rate !== null && r30.n >= 20 && (
        <p className="mt-3 text-sm text-muted">
          {r30.rate < target - 0.03
            ? `Retention is below your ${pct(target)} target: reviews are coming back a little too late for you, which the scheduler optimiser will be able to correct.`
            : r30.rate > target + 0.03
              ? `Retention is above your ${pct(target)} target: you could lower the target in Settings to get fewer reviews.`
              : `Right on your ${pct(target)} target.`}
        </p>
      )}

      <Section title="Words by HSK level" note="A word counts as far as its weakest skill (listening or typing). Mature: next review 21 or more days away.">
        <Legend items={STATES.map((s) => ({ label: STATE_LABEL[s], color: STATE_COLOR[s] }))} />
        <ul className="mt-3 flex flex-col gap-3">
          {levels?.map((l) => (
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

      <Section title="Reviews coming up" note="Cards due each day for the next two weeks. Today includes anything overdue.">
        <Columns
          caption="Reviews due per day, next 14 days"
          data={fc.map((d, i) => ({ key: d.day, label: weekday(d.day, i), value: d.count, detail: `${i === 0 ? 'Today' : dayLabel(d.day)}: ${d.count} due` }))}
          labelEvery={1}
        />
      </Section>

      <ReviewCards />

      <Section title="Tones" note="From the Tone Gym, tone exercises and every typed answer. Rows are the right tone, columns what you heard or typed.">
        <div className="mb-4 grid grid-cols-5 gap-2 text-center">
          {tones.map((t) => (
            <div key={t.tone} className="rounded-xl bg-surface p-2">
              <p className={`text-xs font-semibold ${TONE_TEXT[t.tone]}`}>{TONE_WORD[t.tone]}</p>
              <p className="text-lg font-semibold tabular-nums">{pct(t.rate)}</p>
              <p className="text-[10px] text-muted">{t.n} heard</p>
            </div>
          ))}
        </div>
        <ToneMatrix logs={toneLogs} />
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
          color="var(--gold)"
          labelEvery={7}
          data={days.map((d) => ({ key: d.day, label: dom(d.day), value: d.xp, detail: `${dayLabel(d.day)}: ${d.xp} XP${d.xp >= settings.dailyGoal ? ' · goal met' : ''}` }))}
        />
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

      <Section title="Achievements" note={`${game?.unlocked.size ?? 0} of ${ACHIEVEMENTS.length} unlocked.`}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = game?.unlocked.get(a.id);
            const p = game ? a.progress(game.stats) : 0;
            return (
              <li key={a.id} className={`card flex items-center gap-3 p-3 ${at ? '' : 'shadow-none'}`}>
                <span
                  className={`han flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${at ? 'border-[1.5px] border-gold bg-amber-soft text-gold' : 'border border-line text-muted'}`}
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
                  {!at && <ProgressBar value={p} label={`${a.title} progress`} tone="gold" className="mt-1.5" />}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
