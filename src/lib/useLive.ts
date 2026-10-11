import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/** Subscribe to a Dexie live query. Returns `fallback` until the first result. */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[], fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
