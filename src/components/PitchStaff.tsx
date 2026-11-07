/**
 * Chao's five pitch levels as a staff, with a tone drawn across it as a stroke:
 * 1 = 5-5 (high, level), 2 = 3-5 (rising), 3 = 2-1-4 (dipping), 4 = 5-1 (falling).
 * `draw` animates the stroke along the staff (respecting reduced motion).
 */
const Y = (level: number) => 6 + (5 - level) * 12; // level 5 at the top, 1 at the bottom
const STROKE: Record<number, string> = {
  1: `M10 ${Y(5)} L90 ${Y(5)}`,
  2: `M10 ${Y(3)} C40 ${Y(3)}, 60 ${Y(4)}, 90 ${Y(5)}`,
  3: `M10 ${Y(2)} C30 ${Y(1) + 4}, 50 ${Y(1) + 4}, 62 ${Y(1.5)} S84 ${Y(4)}, 90 ${Y(4)}`,
  4: `M10 ${Y(5)} C40 ${Y(5)}, 60 ${Y(3)}, 90 ${Y(1)}`,
};
const COLOR = ['', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)'];

export function PitchStaff({ tone, draw = false, className = '', lines = true }: { tone?: number; draw?: boolean; className?: string; lines?: boolean }) {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className={className} aria-hidden>
      {lines &&
        [1, 2, 3, 4, 5].map((l) => <line key={l} x1="0" x2="100" y1={Y(l)} y2={Y(l)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      {tone && STROKE[tone] && (
        <path
          d={STROKE[tone]}
          fill="none"
          stroke={COLOR[tone]}
          strokeWidth="3.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className={draw ? 'staff-draw' : undefined}
        />
      )}
    </svg>
  );
}
