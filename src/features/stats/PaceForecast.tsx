/**
 * "When do I reach…?" (IDEAS #11): dates for the next milestones at your last
 * 4 weeks' pace, with your best and slowest week as the range.
 */
import { useMemo } from 'react';
import type { ReviewLogRow } from '../../db/db';
import type { GameStats } from '../../lib/gameStats';
import { ACHIEVEMENTS } from '../../lib/gamify';
import { forecast, MIN_HISTORY_DAYS, nextMilestone, weeklyGains, type Forecast, type PaceMetric } from '../../lib/pace';
import type { LevelRow } from '../../lib/statsData';

const YEAR = 365 * 864e5;
const fmt = (t: number, now: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });

function When({ f, now }: { f: Forecast; now: number }) {
  if (f.at - now > 5 * YEAR) return <span className="text-muted">years away at this pace</span>;
  const range = f.late === Infinity || f.late - now > 5 * YEAR ? `${fmt(f.early, now)} or later` : `${fmt(f.early, now)} – ${fmt(f.late, now)}`;
  return (
    <span className="text-right">
      <span className="block font-semibold tabular-nums">around {fmt(f.at, now)}</span>
      <span className="block text-xs tabular-nums text-muted">{range}</span>
    </span>
  );
}

export function PaceForecast({ logs, now, mature, levels, game }: { logs: ReviewLogRow[]; now: number; mature: number; levels: LevelRow[] | null; game: GameStats | null }) {
  const weeks = useMemo(() => weeklyGains(logs, now), [logs, now]);
  const rows = useMemo(() => {
    if (!weeks) return [];
    const out: Array<{ label: string; f: Forecast | null }> = [];
    const m = nextMilestone(mature);
    if (m) out.push({ label: `${m.toLocaleString('en-GB')} mature words`, f: forecast(m - mature, weeks.matureWords, now) });
    // Next HSK level: when 80% of your current level's words are started (the app then moves you on).
    const cur = levels?.find((l) => l.total && (l.total - l.counts.new) / l.total < 0.8);
    if (cur && cur.level < 7) {
      const need = Math.ceil(0.8 * cur.total) - (cur.total - cur.counts.new);
      out.push({ label: `On to HSK ${cur.level + 1}`, f: forecast(need, weeks.startedWords, now) });
    }
    if (game) {
      out.push({ label: `Level ${game.level.level + 1}`, f: forecast(game.level.span - game.level.into, weeks.xp, now) });
      // The next achievement that counts something with a pace (not streaks or best scores).
      const paced = ACHIEVEMENTS.filter((a) => !game.unlocked.has(a.id) && a.key in weeks)
        .map((a) => ({ a, f: forecast(a.target - game.stats[a.key], weeks[a.key as PaceMetric], now) }))
        .filter((x): x is { a: (typeof ACHIEVEMENTS)[number]; f: Forecast } => !!x.f)
        .sort((x, y) => x.f.at - y.f.at)[0];
      if (paced) out.push({ label: `Achievement: ${paced.a.title}`, f: paced.f });
    }
    return out;
  }, [weeks, mature, levels, game, now]);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">When do I get there?</h2>
      <p className="mt-0.5 text-sm leading-snug text-muted">At your pace over the last 4 weeks; the range is your best and your slowest week.</p>
      {!weeks ? (
        <p className="mt-3 rounded-2xl bg-sunk p-4 text-sm text-muted">Not enough data yet: forecasts start after {MIN_HISTORY_DAYS} days of practice.</p>
      ) : (
        <ul className="group-list mt-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{r.label}</span>
              {r.f ? <When f={r.f} now={now} /> : <span className="text-sm text-muted">no progress in the last 4 weeks</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
