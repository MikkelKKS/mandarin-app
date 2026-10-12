/** Progress: what you know, what's due, where the tones trip you up. No streaks or points. */
import { useMemo, useState } from 'react';
import { lookup, units, words } from '../../content';
import { db } from '../../db/db';
import { ToneText } from '../../components/Hanzi';
import { go } from '../../lib/router';
import { computeStats, type Stats } from '../../lib/stats';
import { useLive } from '../../lib/useLive';
import { MiniPlay } from '../exercises/parts';
import { useNodeStates } from '../path/PathView';

const TONE_NAME = ['', '1st', '2nd', '3rd', '4th', 'neutral'];
const TONE_BG = ['', 'bg-t1', 'bg-t2', 'bg-t3', 'bg-t4', 'bg-t5'];
const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];
const LEVEL_HANZI = ['', '一级', '二级', '三级', '三级'];

export function useStats(): Stats | null {
  const states = useNodeStates();
  const items = useLive(() => db.reviewItems.toArray(), [], null);
  const logs = useLive(() => db.reviewLogs.toArray(), [], null);
  return useMemo(() => {
    if (!items || !logs) return null;
    const statWords = [...words.values()].map((w) => ({ id: w.id, hsk: w.hsk, unit: '' }));
    const statUnits = units.map((u) => ({ id: u.id, title: u.title, titleHanzi: u.titleHanzi, hsk: u.hsk, nodes: u.nodes.map((n) => n.id) }));
    return computeStats({ words: statWords, units: statUnits, items, logs, states, now: Date.now() });
  }, [items, logs, states]);
}

export function ProgressView() {
  const s = useStats();
  if (!s) return <p className="p-8 text-center text-muted">Loading…</p>;
  const fresh = s.wordsSeen === 0;
  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold">Progress</h1>
      <Level s={s} />
      {fresh && (
        <p className="mt-4 rounded-2xl bg-sunk p-4 text-muted">
          This page fills up as you do lessons. Start with the first skill on the path.
        </p>
      )}
      <Coverage s={s} />
      <button onClick={() => go('progress/words')} className="mt-4 h-12 w-full rounded-2xl bg-jade font-semibold text-jade-ink">
        See all HSK words
      </button>
      <button onClick={() => go('music')} className="mt-4 h-12 w-full rounded-2xl border-2 border-line font-medium">
        Find songs at {s.level > 3 ? 'your level' : `HSK ${s.level}`}
      </button>
      <Reviews s={s} />
      <Tones s={s} />
      <Missed s={s} />
      <Activity s={s} />
      <Units s={s} />
    </div>
  );
}

function Section({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-sm text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Level({ s }: { s: Stats }) {
  const done = s.level > 3;
  return (
    <div className="relative mt-5 flex items-center gap-5 overflow-hidden rounded-3xl bg-jade p-5 text-jade-ink">
      <span className="han anim-pop shrink-0 whitespace-nowrap text-5xl font-bold leading-none" aria-hidden>
        {LEVEL_HANZI[s.level]}
      </span>
      <div>
        <p className="text-sm opacity-80">{done ? 'All of HSK 1 to 3' : 'Working on'}</p>
        <p className="text-2xl font-bold">{done ? 'Mostly known' : `HSK ${s.level}`}</p>
        <p className="mt-1 text-sm opacity-90">
          {s.wordsKnown} words known, {s.wordsSeen - s.wordsKnown} still settling in
        </p>
      </div>
    </div>
  );
}

function Coverage({ s }: { s: Stats }) {
  return (
    <Section title="HSK words" note="Known means it's in long-term review. Settling in means you've met it but it's still coming back often.">
      <ul className="flex flex-col gap-4">
        {s.coverage.map((c) => {
          const k = c.total ? (c.known / c.total) * 100 : 0;
          const l = c.total ? (c.learning / c.total) * 100 : 0;
          return (
            <li key={c.level}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="font-semibold">HSK {c.level}</span>
                <span className="text-sm tabular-nums text-muted">
                  {c.known} of {c.total} known
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`HSK ${c.level}: ${c.known} known, ${c.learning} settling in, of ${c.total}`}>
                <div className="anim-grow-x flex h-full w-full" style={{ animationDelay: `${150 + c.level * 90}ms` }}>
                  <span className="h-full bg-jade" style={{ width: `${k}%` }} />
                  <span className="h-full bg-gold/60" style={{ width: `${l}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-jade" /> Known
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold/60" /> Settling in
        </span>
      </p>
    </Section>
  );
}

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  const d = new Date(Date.now() + offset * 864e5);
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

function Reviews({ s }: { s: Stats }) {
  const days = [s.dueNow + s.forecast[0], ...s.forecast.slice(1)];
  const max = Math.max(1, ...days);
  return (
    <Section title="Reviews">
      <div className="flex items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4">
        <div className="flex-1">
          <p className="text-3xl font-bold tabular-nums">{s.dueNow}</p>
          <p className="text-sm text-muted">{s.dueNow === 1 ? 'review due now' : 'reviews due now'}</p>
        </div>
        <button onClick={() => go('practice')} className="press h-12 rounded-2xl bg-jade px-5 font-semibold text-jade-ink">
          Practise
        </button>
      </div>
      <p className="mt-5 text-sm font-medium">Coming up this week</p>
      <p className="text-xs text-muted">How many words and sentences come back for review each day. The app spaces them out so you see each one just before you'd forget it.</p>
      <div className="mt-3 grid grid-cols-7 items-end gap-2" role="img" aria-label={`Reviews due over the next week: ${days.join(', ')}`}>
        {days.map((n, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-muted">{n || ''}</span>
            <div className="flex h-20 w-full items-end">
              <span
                className={`anim-grow-y w-full rounded-t-md ${i === 0 ? 'bg-jade' : 'bg-jade/40'}`}
                style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%`, animationDelay: `${i * 50}ms` }}
              />
            </div>
            <span className="text-xs text-muted">{dayLabel(i)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Tones({ s }: { s: Stats }) {
  const any = s.tones.some((t) => t.attempts > 0);
  return (
    <Section title="Tones by ear" note={any ? 'From the "which tone do you hear?" exercises.' : 'Do a few lessons with tone exercises to see how you hear each tone.'}>
      <div className="grid grid-cols-5 gap-2">
        {s.tones.map((t) => {
          const pct = t.attempts ? Math.round((t.right / t.attempts) * 100) : null;
          return (
            <div key={t.tone} className="flex flex-col items-center rounded-2xl bg-surface p-3">
              <span className={`text-xs font-semibold ${TONE_TEXT[t.tone]}`}>{TONE_NAME[t.tone]}</span>
              <span className="mt-1 text-xl font-bold tabular-nums">{pct === null ? '–' : `${pct}%`}</span>
              <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunk">
                <span className={`anim-grow-x block h-full ${TONE_BG[t.tone]}`} style={{ width: `${pct ?? 0}%`, animationDelay: `${t.tone * 70}ms` }} />
              </span>
              <span className="mt-1 text-[11px] tabular-nums text-muted">{t.attempts ? `of ${t.attempts}` : ' '}</span>
            </div>
          );
        })}
      </div>
      {s.confusions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {s.confusions.map((c) => (
            <li key={`${c.expected}-${c.given}`} className="rounded-xl bg-sunk px-4 py-3 text-sm">
              You answered <b className={TONE_TEXT[c.given]}>{TONE_NAME[c.given]}</b> for a{' '}
              <b className={TONE_TEXT[c.expected]}>{TONE_NAME[c.expected]} tone</b>, {c.count} {c.count === 1 ? 'time' : 'times'}.
            </li>
          ))}
        </ul>
      )}
      {s.confusions.length > 0 && (
        <button onClick={() => go('game/tone-pairs')} className="mt-3 h-11 w-full rounded-2xl border-2 border-line font-medium">
          Drill tone pairs
        </button>
      )}
    </Section>
  );
}

function Missed({ s }: { s: Stats }) {
  const rows = s.missed.map((m) => ({ ...m, item: lookup(m.id) })).filter((m) => m.item);
  if (!rows.length) return null;
  return (
    <Section title="To work on" note="Missed most often in the last two months. They come back in Practice.">
      <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface">
        {rows.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <MiniPlay id={m.id} label={`Play ${m.item!.hanzi}`} />
            <div className="min-w-0 flex-1">
              <ToneText hanzi={m.item!.hanzi} pinyin={m.item!.pinyin} className="han text-xl" />
              <p className="truncate text-sm text-muted">
                {m.item!.pinyin}, {m.item!.english}
              </p>
            </div>
            <span className="text-right text-xs tabular-nums text-muted">
              {m.wrong} of {m.total}
              <br />
              missed
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Activity({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.activity);
  const total = s.activity.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return (
    <Section title="Last two weeks" note={`${total} answers in 14 days.`}>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={`Answers per day over the last 14 days: ${s.activity.join(', ')}`}>
        {s.activity.map((n, i) => (
          <span
            key={i}
            title={`${n} answers`}
            className={`anim-grow-y flex-1 rounded-t-sm ${i === 13 ? 'bg-jade' : 'bg-jade/40'}`}
            style={{ height: `${n ? Math.max(8, (n / max) * 100) : 3}%`, animationDelay: `${i * 30}ms` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>2 weeks ago</span>
        <span>Today</span>
      </div>
    </Section>
  );
}

function Units({ s }: { s: Stats }) {
  const [all, setAll] = useState(false);
  // Units you've started, plus the next one; everything with "Show all".
  const started = s.units.filter((u) => u.mastery > 0);
  const next = s.units.find((u) => u.mastery === 0);
  const shown = all ? s.units : [...started, ...(next ? [next] : [])];
  return (
    <Section title="Units" note={`${s.units.filter((u) => u.done === u.total).length} of ${s.units.length} complete.`}>
      <ul className="stagger flex flex-col gap-2">
        {shown.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
            <span className="han w-24 shrink-0 truncate font-semibold" lang="zh-CN">
              {u.titleHanzi}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{u.title}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
                <span className="anim-grow-x block h-full bg-gold" style={{ width: `${(u.mastery / (u.total * 5)) * 100}%` }} />
              </div>
            </div>
            <span className="text-xs tabular-nums text-muted">
              {u.done}/{u.total}
            </span>
          </li>
        ))}
      </ul>
      {shown.length < s.units.length || all ? (
        <button onClick={() => setAll(!all)} className="mt-3 h-11 w-full rounded-2xl border-2 border-line font-medium">
          {all ? 'Show fewer' : `Show all ${s.units.length} units`}
        </button>
      ) : null}
    </Section>
  );
}
