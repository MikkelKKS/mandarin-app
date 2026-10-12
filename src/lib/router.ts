import { useEffect, useState } from 'react';

/** Minimal hash router: "#/lesson/n01-names" → ["lesson", "n01-names"]. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const h = () => setHash(location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(path: string): void {
  location.hash = path.startsWith('/') ? path : `/${path}`;
  window.scrollTo(0, 0);
}

/**
 * Focus an element when it mounts without scrolling the page. Plain autoFocus
 * scrolls to elements inside sliding sheets (they start off-screen).
 * Use as a ref: <button ref={focusNoScroll}>.
 */
export function focusNoScroll(el: HTMLElement | null): void {
  el?.focus({ preventScroll: true });
}
