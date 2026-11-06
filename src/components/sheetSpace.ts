/**
 * Answer feedback sheets (IDEAS #13): the page leaves room for the sheet's real
 * height (CSS variable --sheet-h on <html>), and once it appears the right
 * answer option is scrolled into view if the sheet would cover it. The first
 * scroll happens before the sheet's first frame is painted, so the eye sees one
 * movement (the sheet rising) instead of the page sliding under the thumb as well.
 */
import { useLayoutEffect, type RefObject } from 'react';

/** Bottom padding for an exercise page: room for the feedback sheet, at least `min`. */
export const sheetPadding = (min = '18rem') => ({ paddingBottom: `max(${min}, calc(var(--sheet-h, 0px) + 1.5rem))` });

export function useSheetSpace(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const started = performance.now();
    const reveal = () => {
      const right = document.querySelector<HTMLElement>('[data-state="right"]');
      if (!right) return;
      const h = el.getBoundingClientRect().height;
      const r = right.getBoundingClientRect();
      const limit = window.innerHeight - h - 12;
      if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: 'instant' });
    };
    const update = () => {
      root.style.setProperty('--sheet-h', `${Math.round(el.getBoundingClientRect().height)}px`);
      // The sheet's height can still change in its first moments (fonts, review-grade row),
      // so keep checking for a short while instead of only once.
      if (performance.now() - started < 1000) requestAnimationFrame(reveal);
    };
    update();
    reveal(); // before the first paint
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--sheet-h');
    };
  }, [ref]);
}
