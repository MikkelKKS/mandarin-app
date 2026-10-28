/** A thin progress bar (0–1). */
export function ProgressBar({ value, label, className = '', tone = 'jade' }: { value: number; label: string; className?: string; tone?: 'jade' | 'gold' }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`block h-1.5 overflow-hidden rounded-full bg-sunk ${className}`}
    >
      <span className={`block h-full rounded-full transition-[width] duration-500 [transition-timing-function:var(--ease-out)] ${tone === 'gold' ? 'bg-gold' : 'bg-jade'}`} style={{ width: `${v * 100}%` }} />
    </span>
  );
}
