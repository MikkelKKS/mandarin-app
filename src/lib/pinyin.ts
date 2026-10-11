/**
 * Low-level pinyin utilities: parsing tone marks / tone numbers, segmenting
 * joined pinyin into syllables, and rendering syllables back with tone marks.
 * Internally ü is written as "v".
 */
import { SYLLABLES } from './syllables.generated';

export type Tone = 1 | 2 | 3 | 4 | 5; // 5 = neutral

export interface Syllable {
  base: string; // toneless, lowercase, ü as v (e.g. "nv", "hao")
  tone: Tone;
}

/** One letter of input with the tone information attached to it. */
export interface Letter {
  ch: string; // a-z (v for ü)
  mark?: Tone; // tone from a diacritic on this letter
  digit?: Tone; // tone number typed right after this letter
  boundaryBefore: boolean; // space / apostrophe / punctuation before it
}

const MARKED: Record<string, [string, Tone]> = {};
const VOWEL_MARKS: Record<string, string> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  v: 'ǖǘǚǜ',
};
for (const [v, marks] of Object.entries(VOWEL_MARKS)) {
  [...marks].forEach((m, i) => (MARKED[m] = [v, (i + 1) as Tone]));
}

export function isValidSyllable(base: string): boolean {
  return SYLLABLES.has(base);
}

export function isHanzi(ch: string): boolean {
  return /\p{Script=Han}/u.test(ch);
}

/** Strip everything that isn't a Chinese character. */
export function hanziOnly(text: string): string {
  return [...text].filter(isHanzi).join('');
}

/** Turn free-form pinyin (marks, numbers, u:, ü, v, any case) into letters. */
export function toLetters(input: string): Letter[] {
  const s = input.normalize('NFC').toLowerCase().replace(/u:/g, 'v');
  const out: Letter[] = [];
  let boundary = true;
  for (const raw of s) {
    if (MARKED[raw]) {
      const [ch, tone] = MARKED[raw];
      out.push({ ch, mark: tone, boundaryBefore: boundary });
      boundary = false;
    } else if (raw === 'ü') {
      out.push({ ch: 'v', boundaryBefore: boundary });
      boundary = false;
    } else if (raw >= 'a' && raw <= 'z') {
      out.push({ ch: raw, boundaryBefore: boundary });
      boundary = false;
    } else if (raw >= '0' && raw <= '5') {
      const last = out[out.length - 1];
      if (last && last.digit === undefined) last.digit = raw === '0' ? 5 : (Number(raw) as Tone);
      boundary = true;
    } else {
      // spaces, apostrophes, punctuation, anything else
      boundary = true;
    }
  }
  return out;
}

/**
 * Split letters into valid syllables. Honours explicit boundaries (spaces,
 * apostrophes, tone digits) and allows at most one tone mark per syllable.
 * If `count` is given, only segmentations with exactly that many syllables count.
 * Among candidates, prefers the fewest syllables. Returns syllable ranges.
 */
export function segmentLetters(letters: Letter[], count?: number): Array<[number, number]> | null {
  const n = letters.length;
  if (n === 0) return count === undefined || count === 0 ? [] : null;
  // best[i] = map from syllable count -> previous index, for reaching position i
  const reach: Array<Map<number, number>> = Array.from({ length: n + 1 }, () => new Map());
  reach[0].set(0, -1);
  for (let i = 0; i < n; i++) {
    if (reach[i].size === 0) continue;
    let base = '';
    let marks = 0;
    for (let j = i; j < n && j - i < 6; j++) {
      if (j > i && letters[j].boundaryBefore) break;
      if (j > i && letters[j - 1].digit !== undefined) break;
      base += letters[j].ch;
      if (letters[j].mark) marks++;
      if (marks > 1) break;
      const end = j + 1;
      if (SYLLABLES.has(base)) {
        for (const [k] of reach[i]) {
          if (count !== undefined && k + 1 > count) continue;
          if (!reach[end].has(k + 1)) reach[end].set(k + 1, i);
        }
      }
    }
  }
  const ends = reach[n];
  if (ends.size === 0) return null;
  let k: number;
  if (count !== undefined) {
    if (!ends.has(count)) return null;
    k = count;
  } else {
    k = Math.min(...ends.keys());
  }
  // Walk back
  const ranges: Array<[number, number]> = [];
  let pos = n;
  while (pos > 0) {
    const prev = reach[pos].get(k)!;
    ranges.unshift([prev, pos]);
    pos = prev;
    k--;
  }
  return ranges;
}

/** Tone of a letter range: diacritic or typed digit, or null when absent. */
export function rangeTone(letters: Letter[], [s, e]: [number, number]): Tone | null | 'conflict' {
  const tones = new Set<Tone>();
  for (let i = s; i < e; i++) {
    if (letters[i].mark) tones.add(letters[i].mark!);
    if (letters[i].digit) tones.add(letters[i].digit!);
  }
  if (tones.size === 0) return null;
  if (tones.size > 1) return 'conflict';
  return [...tones][0];
}

/**
 * Parse well-formed content pinyin (tone marks; unmarked syllables are
 * neutral). Returns null if it cannot be segmented (into `count` syllables).
 */
export function parsePinyin(text: string, count?: number): Syllable[] | null {
  const letters = toLetters(text);
  const ranges = segmentLetters(letters, count);
  if (!ranges) return null;
  const out: Syllable[] = [];
  for (const r of ranges) {
    const t = rangeTone(letters, r);
    if (t === 'conflict') return null;
    out.push({ base: letters.slice(r[0], r[1]).map((l) => l.ch).join(''), tone: t ?? 5 });
  }
  return out;
}

/** Put the tone mark on the right vowel: a/e first, then o in "ou", else last vowel. */
export function markSyllable({ base, tone }: Syllable): string {
  const display = (s: string) => s.replace(/v/g, 'ü');
  if (tone === 5) return display(base);
  let idx = base.search(/[ae]/);
  if (idx < 0) idx = base.indexOf('ou');
  if (idx < 0) {
    for (let i = base.length - 1; i >= 0; i--) {
      if ('aeiouv'.includes(base[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return display(base);
  const marked = VOWEL_MARKS[base[idx]][tone - 1];
  return display(base.slice(0, idx) + marked + base.slice(idx + 1));
}

export function syllableToNumeric({ base, tone }: Syllable): string {
  return base + tone;
}

/** "nǐ hǎo" -> "ni3 hao3"; keeps word grouping by spaces. */
export function toNumeric(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const syl = parsePinyin(word);
      return syl ? syl.map(syllableToNumeric).join('') : word;
    })
    .join(' ');
}

/** Tone of each syllable in a content pinyin string. */
export function tonesOf(text: string, count?: number): Tone[] {
  return (parsePinyin(text, count) ?? []).map((s) => s.tone);
}
