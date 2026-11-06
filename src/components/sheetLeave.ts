/**
 * The answer feedback sheet leaves before the next question comes in: Continue
 * (button or Enter) plays a short exit (`.anim-sheet-out`, ease-in) and then moves on.
 * With reduced motion it moves on at once. A second press while leaving is ignored.
 */
import { useCallback, useRef, useState } from 'react';

const LEAVE_MS = 150;
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useLeave(): [leaving: boolean, leave: (done: () => void) => void] {
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  const leave = useCallback((done: () => void) => {
    if (busy.current) return;
    if (reduced()) {
      done();
      return;
    }
    busy.current = true;
    setLeaving(true);
    setTimeout(() => {
      busy.current = false;
      setLeaving(false);
      done();
    }, LEAVE_MS);
  }, []);
  return [leaving, leave];
}
