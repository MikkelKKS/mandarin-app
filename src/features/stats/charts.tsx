/**
 * Small charts for the Stats screen, in plain HTML (see the dataviz rules:
 * one hue per chart, columns at most 24px with a rounded data end and a 2px
 * gap, a hairline baseline, selective labels, a tooltip on hover/focus, and a
 * table view for every chart).
 */
import type { ReactNode } from 'react';

export interface Column {
  key: string | number;
  /** Axis label (shown for some columns only). */
  label: string;
  value: number;
  /** Tooltip text. */
  detail: string;
}

/** Vertical columns, one series. */
export function Columns({
  data,
  color = 'var(--jade)',
  height = 112,
  labelEvery = 1,
  format = (v: number) => String(v),
  caption,
}: {
  data: Column[];
  color?: string;
  height?: number;
  /** Show every nth axis label (the first and last are always shown). */
  labelEvery?: number;
  format?: (v: number) => string;
  caption: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  return (
    <figure>
      <div className="relative flex items-end gap-[2px] border-b border-line" style={{ height }} role="img" aria-label={caption}>
        {data.map((d, i) => {
          const h = d.value ? Math.max(3, (d.value / max) * (height - 18)) : 0;
          const showValue = d.value > 0 && (i === peak || i === data.length - 1);
          return (
            <div key={d.key} tabIndex={0} aria-label={d.detail} className="group relative flex h-full flex-1 items-end justify-center outline-none">
              {showValue && (
                <span className="absolute text-[11px] tabular-nums text-muted" style={{ bottom: h + 2 }}>
                  {format(d.value)}
                </span>
              )}
              <div className="w-full max-w-6 rounded-t transition-opacity group-hover:opacity-80" style={{ height: h, background: color }} />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-bg shadow group-hover:block group-focus:block">
                {d.detail}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 truncate text-center">
            {i === 0 || i === data.length - 1 || i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <TableView caption={caption} head={['', 'Value']} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

export interface Segment {
  key: string;
  value: number;
  color: string;
  label: string;
}

/** One horizontal bar split into segments (2px surface gaps), scaled to `total`. */
export function StackBar({ segments, total, label }: { segments: Segment[]; total: number; label: string }) {
  return (
    <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded" style={{ background: "color-mix(in oklab, var(--muted) 28%, var(--surface))" }} role="img" aria-label={label}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.key} title={`${s.label}: ${s.value}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(s.value / Math.max(1, total)) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Every chart's numbers as a table, folded away. */
export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs text-muted">Show as a table</summary>
      <table className="mt-2 w-full tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className={`py-1 font-medium ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`py-1 ${j ? 'text-right' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** A big number with a label (for headline figures). */
export function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4 border border-line">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}
