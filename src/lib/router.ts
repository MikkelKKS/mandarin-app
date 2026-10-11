import { useEffect, useState } from 'react';

/** Minimal hash router: "#/lesson/n01-names" → ["lesson", "n01-names"]. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const h = () => setHash(location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(path: string): void {
  location.hash = path.startsWith('/') ? path : `/${path}`;
  window.scrollTo(0, 0);
}
