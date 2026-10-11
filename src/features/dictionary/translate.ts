/**
 * Online sentence translation via the free MyMemory API (no key needed;
 * anonymous use allows ~5,000 characters a day). Results are cached locally
 * so repeated look-ups don't use the quota and work offline.
 */
const API = 'https://api.mymemory.translated.net/get';
const CACHE_KEY = 'translations:v1';

type Dir = 'zh-en' | 'en-zh';

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function writeCache(c: Record<string, string>) {
  try {
    const keys = Object.keys(c);
    if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete c[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* storage full or unavailable */
  }
}

export interface Translation {
  text: string;
  cached: boolean;
}

export async function translate(text: string, dir: Dir, signal?: AbortSignal): Promise<Translation> {
  const q = text.trim().slice(0, 450);
  const key = `${dir}|${q}`;
  const cache = readCache();
  if (cache[key]) return { text: cache[key], cached: true };
  if (!navigator.onLine) throw new Error('Translation needs an internet connection.');
  const langpair = dir === 'zh-en' ? 'zh-CN|en' : 'en|zh-CN';
  let res: Response;
  try {
    res = await fetch(`${API}?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(langpair)}`, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error("Couldn't reach the translation service. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as { responseData?: { translatedText?: string }; responseStatus?: number | string; quotaFinished?: boolean } | null;
  if (!data || Number(data.responseStatus) !== 200 || !data.responseData?.translatedText) {
    if (data?.quotaFinished || Number(data?.responseStatus) === 429) throw new Error("Today's free translation allowance is used up. It resets tomorrow — the word-by-word breakdown still works.");
    throw new Error('The translation service returned an error. Try again in a moment.');
  }
  const out = decodeEntities(data.responseData.translatedText);
  cache[key] = out;
  writeCache(cache);
  return { text: out, cached: false };
}

function decodeEntities(s: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

/** Looks like an English phrase worth translating into Chinese (several words). */
export function looksLikeEnglishSentence(q: string): boolean {
  return /^[a-zA-Z][a-zA-Z' ,.?!-]*$/.test(q.trim()) && q.trim().split(/\s+/).length >= 3;
}
