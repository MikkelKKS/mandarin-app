/**
 * The pitch line of a tone, drawn as a stroke: 1 flat and high, 2 rising, 3 dipping, 4 falling,
 * neutral a short low dot. Used beside tone options, matrix headers and tone-pair labels, so a tone
 * is never shown by colour alone. Inherits the current text colour.
 */
const PATH: Record<number, string> = {
  1: 'M3 3.5 H21',
  2: 'M3 11 L21 3',
  3: 'M3 5 C7 12.5, 11 12.5, 14 10.5 S19 5.5, 21 4',
  4: 'M3 2.5 L21 11.5',
};

export function ToneContour({ tone, className = 'h-3 w-6' }: { tone: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 14" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATH[tone] ? <path d={PATH[tone]} /> : <circle cx="12" cy="10" r="1.8" fill="currentColor" stroke="none" />}
    </svg>
  );
}

/** A tone pattern like "2-3" as contours side by side. */
export function PatternContour({ pattern, className = 'h-3 w-5' }: { pattern: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-hidden>
      {pattern.split('-').map((t, i) => (
        <ToneContour key={i} tone={Number(t)} className={className} />
      ))}
    </span>
  );
}
