/**
 * Study calendar (IDEAS #5): one square per day, shaded by how much of the
 * daily XP goal was reached; a gold ring marks a day a streak freeze saved.
 * Tap or focus a day for its XP, minutes and accuracy. About half a year on a
 * phone, a full year on a PC. Columns are weeks, Monday on top.
 */
import { useMemo, useState } from 'react';
import type { ReviewLogRow } from '../../db/db';
import type { Streak } from '../../lib/gamify';
import { calendarGrid, goalLevel, perDay, type DayRow } from '../../lib/statsData';

const SHADE = [
  'color-mix(in oklab, var(--muted) 18%, var(--surface))',
  'color-mix(in oklab, var(--jade) 25%, var(--surface))',
  'color-mix(in oklab, var(--jade) 50%, var(--surface))',
  'var(--jade)',
  'color-mix(in oklab, var(--jade) 70%, var(--ink))',
];
const LEGEND = ['No study', 'Some', 'Half the goal', 'Goal met', 'Double the goal'];

const fmt = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString('en-GB', o);

export function StudyCalendar({ logs, goal, streak, now }: { logs: ReviewLogRow[]; goal: number; streak: Streak | null; now: number }) {
  const wide = typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 768px)').matches;
  const weeks = wide ? 53 : 26;
  const rows = useMemo(() => perDay(logs, now, weeks * 7 - (6 - ((new Date(now - 4 * 3600e3).getDay() + 6) % 7))), [logs, now, weeks]);
  const grid = useMemo(() => calendarGrid(rows), [rows]);
  const frozen = useMemo(() => new Set(streak?.frozenDays ?? []), [streak]);
  const [picked, setPicked] = useState<DayRow | null>(null);
  const shown = picked ?? rows[rows.length - 1];
  // Month labels above the first week that starts in a new month.
  const months = grid.map((col, i) => {
    const first = col.find(Boolean);
    if (!first) return '';
    const prev = grid[i - 1]?.find(Boolean);
    if (i > grid.length - 3) return ''; // no room for a label at the right edge
    return !prev || new Date(prev.day).getMonth() !== new Date(first.day).getMonth() ? fmt(first.day, { month: 'short' }) : '';
  });
  const describe = (d: DayRow) =>
    `${fmt(d.day, { weekday: 'short', day: 'numeric', month: 'short', ...(new Date(d.day).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) })}: ${d.xp} XP${d.xp >= goal ? ' (goal met)' : frozen.has(d.day) ? ' (saved by a freeze)' : ''}, ${d.minutes} min${d.answers ? `, ${Math.round((d.accuracy ?? 0) * 100)}% of ${d.answers} answers` : ''}`;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Current streak', streak?.current ?? 0],
          ['Longest', streak?.best ?? 0],
          ['Freezes in bank', streak?.freezes ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl bg-surface p-2">
            <p className="text-lg font-semibold tabular-nums">{n}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex" role="grid" aria-label={`Study calendar, last ${weeks} weeks`}>
        <div className="min-w-0 flex-1">
          <div className="flex h-4 gap-[2px] text-xs leading-none text-muted" aria-hidden>
            {months.map((m, i) => (
              <span key={i} className="relative flex-1">
                {m && <span className="absolute left-0 whitespace-nowrap">{m}</span>}
              </span>
            ))}
          </div>
          <div className="flex gap-[2px]">
            {grid.map((col, i) => (
              <div key={i} role="row" className="flex flex-1 flex-col gap-[2px]">
                {col.map((d, j) =>
                  d ? (
                    <button
                      key={j}
                      role="gridcell"
                      onClick={() => setPicked(d)}
                      onFocus={() => setPicked(d)}
                      aria-label={describe(d)}
                      aria-selected={shown?.day === d.day}
                      className={`aspect-square w-full rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ink ${shown?.day === d.day ? 'ring-1 ring-ink' : frozen.has(d.day) ? 'ring-[1.5px] ring-inset ring-gold' : ''}`}
                      style={{ background: SHADE[goalLevel(d.xp, goal)] }}
                    />
                  ) : (
                    <span key={j} className="aspect-square w-full" aria-hidden />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {shown && <p className="mt-2 text-sm tabular-nums">{describe(shown)}</p>}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label="Legend">
        {LEGEND.map((l, i) => (
          <li key={l} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SHADE[i] }} aria-hidden />
            {l}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm ring-[1.5px] ring-inset ring-gold" aria-hidden />
          Freeze
        </li>
      </ul>
    </div>
  );
}
