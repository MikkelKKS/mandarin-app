/**
 * Answer feedback sheets (IDEAS #13): the page leaves room for the sheet's real
 * height (CSS variable --sheet-h on <html>), and once it appears the right
 * answer option is scrolled into view if the sheet would cover it.
 */
import { useEffect, type RefObject } from 'react';

/** Bottom padding for an exercise page: room for the feedback sheet, at least `min`. */
export const sheetPadding = (min = '18rem') => ({ paddingBottom: `max(${min}, calc(var(--sheet-h, 0px) + 1.5rem))` });

export function useSheetSpace(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const started = performance.now();
    let target = -1;
    const reveal = () => {
      const right = document.querySelector<HTMLElement>('[data-state="right"]');
      if (!right) return;
      const h = el.getBoundingClientRect().height;
      const r = right.getBoundingClientRect();
      const limit = window.innerHeight - h - 12;
      if (r.bottom <= limit) return;
      // One smooth scroll per new target: re-requesting it every frame would restart it and stutter.
      const top = Math.round(window.scrollY + r.bottom - limit);
      if (Math.abs(top - target) < 2) return;
      target = top;
      window.scrollTo({ top, behavior: 'smooth' });
    };
    const update = () => {
      root.style.setProperty('--sheet-h', `${Math.round(el.getBoundingClientRect().height)}px`);
      // The sheet's height can still change in its first moments (fonts, review-grade row),
      // so keep checking for a short while instead of only once.
      if (performance.now() - started < 1000) requestAnimationFrame(reveal);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--sheet-h');
    };
  }, [ref]);
}
