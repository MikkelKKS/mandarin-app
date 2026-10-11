/**
 * In-app dictionary (CC-CEDICT, built by scripts/build-dictionary.ts).
 * Loaded on first use and cached by the service worker for offline use.
 */
import { hanziOnly, isHanzi, toLetters, segmentLetters, rangeTone } from '../../lib/pinyin';

export interface Entry {
  hanzi: string;
  pinyin: string; // with tone marks, syllables separated by spaces
  key: string; // toneless letters, e.g. "nihao"
  defs: string[];
  hsk: number;
  tones: string; // e.g. "33"
}

export interface Dict {
  entries: Entry[];
  byHanzi: Map<string, Entry[]>;
  maxLen: number;
}

const MARK_TONES: Record<string, number> = {};
['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'].forEach((s, i) => [...s].forEach((c) => (MARK_TONES[c] = i + 1)));
function tonesOfMarked(p: string): string {
  return p
    .split(' ')
    .map((syl) => {
      for (const c of syl.toLowerCase()) if (MARK_TONES[c]) return String(MARK_TONES[c]);
      return '5';
    })
    .join('');
}

export function parseDict(tsv: string): Dict {
  const entries: Entry[] = [];
  const byHanzi = new Map<string, Entry[]>();
  let maxLen = 1;
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const [hanzi, pinyin, key, defs, hsk] = line.split('\t');
    if (!defs) continue;
    const e: Entry = { hanzi, pinyin, key, defs: defs.split(' / '), hsk: Number(hsk) || 0, tones: tonesOfMarked(pinyin) };
    entries.push(e);
    const list = byHanzi.get(hanzi);
    if (list) list.push(e);
    else byHanzi.set(hanzi, [e]);
    maxLen = Math.max(maxLen, [...hanzi].length);
  }
  return { entries, byHanzi, maxLen: Math.min(maxLen, 8) };
}

let loading: Promise<Dict | null> | null = null;
export function loadDict(): Promise<Dict | null> {
  loading ??= fetch(`${import.meta.env.BASE_URL}dict/cedict.tsv`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((t) => (t.trim() ? parseDict(t) : null))
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

/** Common, short words first; HSK words before rare ones. */
function rank(e: Entry): number {
  return (e.hsk ? e.hsk : 9) * 10 + [...e.hanzi].length + (/^[A-Z]/.test(e.pinyin) ? 5 : 0) + (e.defs[0].startsWith('surname') ? 4 : 0);
}

export type SearchResult =
  | { mode: 'empty' }
  | { mode: 'words'; entries: Entry[] }
  | { mode: 'sentence'; tokens: Array<{ text: string; entries: Entry[] }> };

/** Greedy longest-match segmentation of Chinese text into dictionary words. */
export function segment(dict: Dict, text: string): Array<{ text: string; entries: Entry[] }> {
  const chars = [...text];
  const out: Array<{ text: string; entries: Entry[] }> = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      const t = chars.slice(i, j).join('');
      if (t.trim()) out.push({ text: t, entries: [] });
      i = j;
      continue;
    }
    let found = 1;
    for (let len = Math.min(dict.maxLen, chars.length - i); len > 1; len--) {
      if (dict.byHanzi.has(chars.slice(i, i + len).join(''))) {
        found = len;
        break;
      }
    }
    const t = chars.slice(i, i + found).join('');
    out.push({ text: t, entries: [...(dict.byHanzi.get(t) ?? [])].sort((a, b) => rank(a) - rank(b)) });
    i += found;
  }
  return out;
}

export function search(dict: Dict, raw: string, limit = 40): SearchResult {
  const q = raw.trim();
  if (!q) return { mode: 'empty' };

  // Chinese characters
  if (hanziOnly(q)) {
    const hz = hanziOnly(q);
    const exact = dict.byHanzi.get(hz);
    if (exact || [...hz].length === 1) {
      const starts = dict.entries.filter((e) => e.hanzi !== hz && e.hanzi.startsWith(hz));
      return { mode: 'words', entries: [...(exact ?? []), ...starts.sort((a, b) => rank(a) - rank(b))].slice(0, limit) };
    }
    return { mode: 'sentence', tokens: segment(dict, q) };
  }

  // Pinyin (letters with optional tone marks / numbers)
  const letters = toLetters(q);
  const asciiOnly = /^[\sa-zA-Z0-9:üÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ']+$/.test(q);
  if (asciiOnly && letters.length) {
    const ranges = segmentLetters(letters);
    if (ranges) {
      const key = letters.map((l) => l.ch).join('');
      const tones = ranges.map((r) => rangeTone(letters, r));
      const toneOk = (e: Entry) => tones.every((t, i) => t === null || t === 'conflict' || String(t) === e.tones[i] || (t === 5 && e.tones[i] === '5'));
      const exact = dict.entries.filter((e) => e.key === key && e.tones.length === ranges.length && toneOk(e));
      const prefix = q.length >= 2 ? dict.entries.filter((e) => e.key !== key && e.key.startsWith(key)) : [];
      const words = [...exact.sort((a, b) => rank(a) - rank(b)), ...prefix.sort((a, b) => rank(a) - rank(b))];
      // Pinyin that is also an English word (e.g. "can", "men"): fall through to English too.
      if (words.length >= 3 || !/^[a-z]+$/i.test(q)) return { mode: 'words', entries: words.slice(0, limit) };
      const en = englishSearch(dict, q, limit);
      return { mode: 'words', entries: [...words, ...en.filter((e) => !words.includes(e))].slice(0, limit) };
    }
  }
  return { mode: 'words', entries: englishSearch(dict, q, limit) };
}

function englishSearch(dict: Dict, q: string, limit: number): Entry[] {
  const needle = q.toLowerCase();
  const word = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`);
  const scored: Array<[number, Entry]> = [];
  for (const e of dict.entries) {
    let best = 99;
    for (let i = 0; i < e.defs.length; i++) {
      const d = e.defs[i].toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
      if (d === needle || d === `to ${needle}`) best = Math.min(best, i);
      else if (word.test(d)) best = Math.min(best, 20 + i + d.length / 20);
    }
    if (best < 99) scored.push([best * 10 + rank(e), e]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, e]) => e);
}

export function plecoLink(hanzi: string): string {
  return `plecoapi://x-callback-url/s?q=${encodeURIComponent(hanzi)}`;
}

/**
 * Best-guess characters for a pinyin sentence (like a tiny input method):
 * greedily match the longest run of syllables to a common dictionary word.
 */
export function guessHanzi(dict: Dict, pinyinText: string): { hanzi: string; complete: boolean } | null {
  const letters = toLetters(pinyinText);
  const ranges = segmentLetters(letters);
  if (!ranges || ranges.length < 2) return null;
  const syl = ranges.map((r) => ({ base: letters.slice(r[0], r[1]).map((l) => l.ch).join(''), tone: rangeTone(letters, r) }));
  const byKey = keyIndex(dict);
  let out = '';
  let complete = true;
  let i = 0;
  while (i < syl.length) {
    let picked: Entry | null = null;
    let len = 0;
    for (let n = Math.min(4, syl.length - i); n >= 1 && !picked; n--) {
      const part = syl.slice(i, i + n);
      const cands = (byKey.get(part.map((p) => p.base).join('')) ?? []).filter(
        (e) => e.tones.length === n && part.every((p, k) => p.tone === null || p.tone === 'conflict' || String(p.tone) === e.tones[k] || e.tones[k] === '5'),
      );
      if (cands.length) {
        picked = [...cands].sort((a, b) => rank(a) - rank(b))[0];
        len = n;
      }
    }
    if (picked) {
      out += picked.hanzi;
      i += len;
    } else {
      out += syl[i].base;
      complete = false;
      i++;
    }
  }
  return { hanzi: out, complete };
}

let keyCache: { dict: Dict; map: Map<string, Entry[]> } | null = null;
function keyIndex(dict: Dict): Map<string, Entry[]> {
  if (keyCache?.dict === dict) return keyCache.map;
  const map = new Map<string, Entry[]>();
  for (const e of dict.entries) {
    const list = map.get(e.key);
    if (list) list.push(e);
    else map.set(e.key, [e]);
  }
  keyCache = { dict, map };
  return map;
}

/** Is this input a pinyin sentence (several syllables, all valid pinyin)? */
export function isPinyinSentence(q: string): boolean {
  if (hanziOnly(q)) return false;
  const letters = toLetters(q);
  const ranges = segmentLetters(letters);
  return !!ranges && ranges.length >= 3;
}

/** Toneless pinyin of Chinese text (via the dictionary), for spotting "translations" that are only pinyin. */
export function romanKey(dict: Dict, text: string): string {
  return segment(dict, text)
    .map((t) => t.entries[0]?.key ?? '')
    .join('');
}
