/**
 * The review grade an answer got (Again / Hard / Good / Easy), with a way to
 * change it. Auto-grading decides first; this lets the learner overrule it.
 */
import { useState } from 'react';
import type { RatingName } from '../../lib/review';

const LABEL: Record<RatingName, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const HINT: Record<RatingName, string> = {
  again: 'comes back soon',
  hard: 'comes back a bit sooner',
  good: 'normal interval',
  easy: 'longer interval',
};

export function GradeChip({ rating, onChange }: { rating: RatingName; onChange: (r: RatingName) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <p className="mt-3 text-sm">
        Review grade: <span className="font-semibold">{LABEL[rating]}</span>{' '}
        <span className="opacity-70">({HINT[rating]})</span>{' '}
        <button onClick={() => setOpen(true)} className="ml-1 underline underline-offset-2 opacity-80 hover:opacity-100">
          Change
        </button>
      </p>
    );
  return (
    <div className="mt-3" role="group" aria-label="Review grade">
      <p className="mb-1.5 text-sm">How well did you know it?</p>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(LABEL) as RatingName[]).map((r) => (
          <button
            key={r}
            onClick={() => {
              onChange(r);
              setOpen(false);
            }}
            aria-pressed={r === rating}
            className={`h-10 rounded-xl text-sm font-semibold transition active:scale-95 ${r === rating ? 'bg-surface ring-2 ring-current' : 'bg-surface/60'}`}
          >
            {LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
