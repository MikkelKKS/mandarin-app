/**
 * Online sentence translation. Best: Azure Translator, through the app's own
 * Supabase helper (supabase/functions/translate), when you're signed in and it
 * has been set up. Otherwise the free MyMemory API (no key; rougher, ~5,000
 * characters a day). Results are cached locally, so repeats work offline.
 */
import { segmentLetters, toLetters } from '../../lib/pinyin';
import { client } from '../../sync';

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
  /** Which service it came from. */
  source: 'azure' | 'mymemory';
}

/** The Azure helper turned out to be unavailable (not set up, or not signed in): don't keep asking this session. */
let azureDown = false;

async function viaAzure(q: string, dir: Dir, signal?: AbortSignal): Promise<string | null> {
  const c = azureDown ? null : client();
  if (!c) return null;
  try {
    const sb = await c;
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: q, dir }),
    });
    if (res.status === 404 || res.status === 403 || res.status === 503) azureDown = true;
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string };
    return body.text?.trim() || null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return null;
  }
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
  const azKey = `az|${key}`;
  if (cache[azKey]) return { text: cache[azKey], cached: true, source: 'azure' };
  if (cache[key] && !navigator.onLine) return { text: cache[key], cached: true, source: 'mymemory' };
  if (!navigator.onLine) throw new Error('Translation needs an internet connection.');
  const az = await viaAzure(q, dir, signal);
  if (az) {
    cache[azKey] = az;
    writeCache(cache);
    return { text: az, cached: false, source: 'azure' };
  }
  if (cache[key]) return { text: cache[key], cached: true, source: 'mymemory' };
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
  return { text: out, cached: false, source: 'mymemory' };
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

/**
 * Azure Translator only (the app's own translation function): the English of
 * a line of lyrics, or null when the function isn't set up or can't be reached.
 * Cached like other translations; never falls back to the free service.
 */
export async function translateIfSetUp(text: string, signal?: AbortSignal): Promise<string | null> {
  const q = text.trim().slice(0, 450);
  if (!q) return null;
  const azKey = `az|zh-en|${q}`;
  const cache = readCache();
  if (cache[azKey]) return cache[azKey];
  if (!navigator.onLine) return null;
  const az = await viaAzure(q, 'zh-en', signal);
  if (az) {
    cache[azKey] = az;
    writeCache(cache);
  }
  return az;
}
