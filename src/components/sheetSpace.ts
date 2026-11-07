/**
 * Answer feedback sheets: the page leaves room for the sheet's real height (CSS variable
 * --sheet-h on <html>), so everything can still be scrolled into view. The page itself never
 * moves when the sheet opens: the sheet shows the right answer, so the question stays still
 * (Mikkel, 2026-11-07: replaces the scroll that kept the right option above the sheet).
 */
import { useLayoutEffect, type RefObject } from 'react';

/** Bottom padding for an exercise page: room for the feedback sheet, at least `min`. */
export const sheetPadding = (min = '18rem') => ({ paddingBottom: `max(${min}, calc(var(--sheet-h, 0px) + 1.5rem))` });

export function useSheetSpace(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--sheet-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--sheet-h');
    };
  }, [ref]);
}
