/** How far the Azure recordings have got (counted when the app was last built). */
import progress from 'virtual:audio-progress';

function Bar({ label, done, total, note }: { label: string; done: number; total: number; note?: string }) {
  const frac = total ? done / total : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {done.toLocaleString('en-GB')} / {total.toLocaleString('en-GB')} · {Math.floor(frac * 100)}%
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label={label} aria-valuenow={Math.floor(frac * 100)} aria-valuemax={100}>
        <div className="h-full rounded-full bg-jade transition-[width] duration-700" style={{ width: `${frac * 100}%` }} />
      </div>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function AudioProgress() {
  const { words, sentences, slow, months, builtAt } = progress;
  const normalDone = words.done + sentences.done;
  const normalTotal = words.total + sentences.total;
  const month = new Date().toISOString().slice(0, 7);
  const used = months[month] ?? 0;
  return (
    <div className="flex w-full flex-col gap-3">
      <Bar label="All, normal speed" done={normalDone} total={normalTotal} />
      <Bar label="Words" done={words.done} total={words.total} />
      <Bar label="Sentences" done={sentences.done} total={sentences.total} />
      <Bar label="Slow sentences (0.7×)" done={slow.done} total={slow.total} note="Made after the normal ones, as the monthly free allowance allows." />
      <p className="text-xs text-muted">
        Free characters used this month: {used.toLocaleString('en-GB')} of 500,000. Counted{' '}
        {new Date(builtAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}; it updates after each recording batch.
      </p>
    </div>
  );
}
