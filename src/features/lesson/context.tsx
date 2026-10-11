/**
 * Glue between the lesson player and individual exercise components.
 * Exercises register a `check` function (enables the Check button / Enter)
 * and a `replay` function (space bar). They report outcomes via `answer`.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import type { Outcome } from './types';

export interface LessonApi {
  setCheck: (fn: (() => Outcome | null) | null) => void;
  setReplay: (fn: (() => void) | null) => void;
  /** Report an answer immediately (for exercises without a Check step). */
  answer: (o: Outcome) => void;
  /** True once the exercise has been checked (feedback showing). */
  locked: boolean;
  quiet: boolean;
}

export const LessonCtx = createContext<LessonApi>({
  setCheck: () => {},
  setReplay: () => {},
  answer: () => {},
  locked: false,
  quiet: false,
});

export function useLesson() {
  return useContext(LessonCtx);
}

/** Register the current check function; re-registers when deps change. */
export function useCheck(fn: (() => Outcome) | null, deps: unknown[]) {
  const { setCheck } = useLesson();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    setCheck(fn ? () => ref.current?.() ?? null : null);
    return () => setCheck(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useReplay(fn: (() => void) | null) {
  const { setReplay } = useLesson();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    setReplay(fn ? () => ref.current?.() : null);
    return () => setReplay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!fn]);
}

/** Number keys 1–9 pick options (ignored while typing in an input). */
export function useNumberKeys(count: number, onPick: (i: number) => void, enabled = true) {
  const ref = useRef(onPick);
  ref.current = onPick;
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) {
        e.preventDefault();
        ref.current(n - 1);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [count, enabled]);
}
