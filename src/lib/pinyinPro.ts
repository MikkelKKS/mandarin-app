/** Context-aware pinyin for running text (pinyin-pro), loaded only when needed. */
import { useEffect, useState } from 'react';

export type PinyinFn = (text: string) => string[];
let loading: Promise<PinyinFn> | null = null;

/** Returns a function giving one reading per Chinese character (others dropped), once loaded. */
export function usePinyinFn(): PinyinFn | null {
  const [fn, setFn] = useState<PinyinFn | null>(null);
  useEffect(() => {
    loading ??= import('pinyin-pro').then((m) => (text: string) => m.pinyin(text, { type: 'array', nonZh: 'removed' }));
    let live = true;
    void loading.then((f) => live && setFn(() => f));
    return () => {
      live = false;
    };
  }, []);
  return fn;
}
