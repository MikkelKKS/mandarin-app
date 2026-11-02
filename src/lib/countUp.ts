/**
 * A number that counts up to its value (IDEAS #14: the XP on the end screen).
 * Shows the final value at once when the user prefers reduced motion.
 */
import { useEffect, useState } from 'react';

/** Value shown at fraction `t` (0–1) of the count: ease-out, whole numbers, exact at the end. */
export function countAt(target: number, t: number): number {
  if (t >= 1) return target;
  if (t <= 0) return 0;
  return Math.round(target * (1 - (1 - t) ** 3));
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, ms = 700, delay = 0): number {
  const [v, setV] = useState(() => (reduced() ? target : 0));
  useEffect(() => {
    if (reduced() || target <= 0) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = (now - start) / ms;
      setV(countAt(target, t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}
