/**
 * Online sentence translation via the free MyMemory API (no key needed;
 * anonymous use allows ~5,000 characters a day). Results are cached locally
 * so repeated look-ups don't use the quota and work offline.
 */
import { segmentLetters, toLetters } from '../../lib/pinyin';

const API = 'https://api.mymemory.translated.net/get';
const CACHE_KEY = 'translations:v2';

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

const STOPWORDS = new Set(['the', 'is', 'a', 'an', 'i', 'you', 'it', 'my', 'me', 'to', 'of', 'and', 'are', 'what', 'how', 'do', 'not', 'very', 'he', 'she', 'we']);

/** Output that is just the pinyin of the input (a known quirk of the free service). */
export function looksLikeRomanization(out: string, sourceKey?: string): boolean {
  const key = out.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  if (sourceKey && key && key === sourceKey) return true;
  const words = out.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.some((w) => STOPWORDS.has(w.replace(/[^a-z]/g, '')))) return false;
  return isPinyinish(out);
}

function isPinyinish(s: string): boolean {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => {
      const letters = toLetters(w);
      return letters.length > 0 && !!segmentLetters(letters);
    });
}

export async function translate(text: string, dir: Dir, signal?: AbortSignal, sourceKey?: string): Promise<Translation> {
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
  const data = (await res.json().catch(() => null)) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    quotaFinished?: boolean;
    matches?: Array<{ translation?: string; quality?: number | string; match?: number; 'created-by'?: string }>;
  } | null;
  if (!data || Number(data.responseStatus) !== 200 || !data.responseData?.translatedText) {
    if (data?.quotaFinished || Number(data?.responseStatus) === 429) throw new Error("Today's free translations are used up. They reset tomorrow.");
    throw new Error('The translation service returned an error. Try again in a moment.');
  }
  // Candidates: the main answer, then machine translations, then the best memory matches.
  const matches = [...(data.matches ?? [])].sort(
    (a, b) =>
      Number(b['created-by'] === 'MT!') - Number(a['created-by'] === 'MT!') || (b.match ?? 0) * Number(b.quality ?? 0) - (a.match ?? 0) * Number(a.quality ?? 0),
  );
  const candidates = [data.responseData.translatedText, ...matches.map((m) => m.translation ?? '')].map(decodeEntities).filter(Boolean);
  const out = dir === 'zh-en' ? candidates.find((c) => !looksLikeRomanization(c, sourceKey)) : candidates[0];
  if (!out) throw new Error('No reliable translation found. See the word breakdown.');
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
