/**
 * Chao's five pitch levels as a staff, with a tone drawn across it as a stroke:
 * 1 = 5-5 (high, level), 2 = 3-5 (rising), 3 = 2-1-4 (dipping), 4 = 5-1 (falling).
 * `draw` animates the stroke along the staff; `dashed` shows a guess underneath the right one.
 * `aspect` (width / height of the box it fills) keeps the drawing unstretched, so strokes keep
 * an even thickness and the drawing animation runs along the whole stroke.
 */
const Y = (level: number) => 6 + (5 - level) * 12; // level 5 at the top, 1 at the bottom

function strokeFor(tone: number, w: number): string | null {
  const X = (x: number) => (x * w) / 100;
  switch (tone) {
    case 1:
      return `M${X(10)} ${Y(5)} L${X(90)} ${Y(5)}`;
    case 2:
      return `M${X(10)} ${Y(3)} C${X(40)} ${Y(3)}, ${X(60)} ${Y(4)}, ${X(90)} ${Y(5)}`;
    case 3:
      return `M${X(10)} ${Y(2)} C${X(30)} ${Y(1) + 4}, ${X(50)} ${Y(1) + 4}, ${X(62)} ${Y(1.5)} S${X(84)} ${Y(4)}, ${X(90)} ${Y(4)}`;
    case 4:
      return `M${X(10)} ${Y(5)} C${X(40)} ${Y(5)}, ${X(60)} ${Y(3)}, ${X(90)} ${Y(1)}`;
    default:
      return null;
  }
}
const COLOR = ['', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)'];

export function PitchStaff({
  tone,
  draw = false,
  className = '',
  lines = true,
  dashed = false,
  aspect = 100 / 60,
}: {
  tone?: number;
  draw?: boolean;
  className?: string;
  lines?: boolean;
  dashed?: boolean;
  aspect?: number;
}) {
  const w = Math.round(60 * aspect);
  const d = tone ? strokeFor(tone, w) : null;
  return (
    <svg viewBox={`0 0 ${w} 60`} preserveAspectRatio="none" className={className} aria-hidden>
      {lines && [1, 2, 3, 4, 5].map((l) => <line key={l} x1="0" x2={w} y1={Y(l)} y2={Y(l)} stroke="var(--line)" strokeWidth="1.5" />)}
      {d && (
        <path
          d={d}
          fill="none"
          stroke={COLOR[tone!]}
          strokeWidth={dashed ? 4 : 6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={dashed ? '0.03 0.025' : undefined}
          opacity={dashed ? 0.7 : 1}
          className={draw && !dashed ? 'staff-draw' : undefined}
        />
      )}
    </svg>
  );
}
