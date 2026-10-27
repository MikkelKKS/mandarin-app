/**
 * Checks a typed pinyin answer against the expected answer.
 *
 * Accepts tone marks, tone numbers (0/5 = neutral), v or u: for ü, any case,
 * any spacing, apostrophes, hyphens and punctuation. Lenient about 不/一 tone
 * changes and third-tone sandhi.
 *
 * Syllables and tones are scored separately: every expected syllable gets a
 * status (right, wrong tone, no tone, wrong syllable, left out), even when
 * other syllables are wrong, so the feedback can show exactly what to fix.
 *
 * Tones: strict (the default) makes any wrong or missing tone "wrong" (Again).
 * Lenient makes right syllables with a wrong or missing tone "almost" (Hard).
 * One-letter slips on long answers pass as "typo" with the correction shown.
 */
import citation from 'virtual:citation-tones';
import {
  alignToHanzi,
  type Letter,
  type Syllable,
  type Tone,
  hanziOnly,
  markSyllable,
  parsePinyin,
  rangeTone,
  segmentLetters,
  toLetters,
} from './pinyin';

export type Verdict = 'correct' | 'almost' | 'typo' | 'wrong';

export interface ExpectedPinyin {
  pinyin: string; // with tone marks, as written in content
  hanzi?: string; // used for 不/一 and neutral-tone leniency
}

/**
 * ok: right syllable, right tone. missing: right syllable, no tone typed.
 * wrong-tone: right syllable, wrong tone. wrong-syllable: a different syllable
 * was typed in its place. skipped: nothing was typed for it.
 */
export type SyllableStatus = 'ok' | 'missing' | 'wrong-tone' | 'wrong-syllable' | 'skipped';

export interface SyllableFeedback {
  expected: string; // marked syllable, e.g. "hǎo"
  status: SyllableStatus;
  /** Expected tone (1 to 5) and the tone typed (null if none), for tone statistics. */
  tone?: number;
  given?: number | null;
  /** What was typed for this syllable (marked), when it differs from the expected one. */
  typed?: string;
}

export interface PinyinCheck {
  verdict: Verdict;
  reason?: 'missing-tones' | 'wrong-tones' | 'typo' | 'mismatch' | 'empty';
  syllables?: SyllableFeedback[];
  /** Typed syllables that don't belong anywhere in the answer. */
  extra?: string[];
  /** The answer to show as the correct version. */
  correction: string;
  /** Set when the answer was accepted with an equivalent character (他 for 她): the expected characters. */
  otherAnswer?: string;
}

/** 他, 她 and 它 all sound tā: when context doesn't say who, any of them is fine. */
const sameSound = (h: string) => h.replace(/[她它]/g, '他');

export interface CheckOptions {
  /** Strict (default): wrong or missing tones are wrong. Lenient: right syllables with tone slips are "almost". */
  strictTones?: boolean;
  alternatives?: ExpectedPinyin[];
}

interface ExpectedSyllable extends Syllable {
  hanzi?: string;
  accepted: Set<Tone>;
}

/** Dictionary tones of a character (precomputed at build time for all content). */
function citationTones(ch: string): Tone[] {
  return (citation[ch] ?? []) as Tone[];
}

export function buildExpected(exp: ExpectedPinyin): ExpectedSyllable[] | null {
  const al = exp.hanzi ? alignToHanzi(exp.hanzi, exp.pinyin) : null;
  const syl = al ? al.syls : parsePinyin(exp.pinyin);
  if (!syl) return null;
  // First character of each syllable (a merged 儿 belongs to the previous one).
  const firstChar = (i: number) => (al ? al.chars[al.charSyl.indexOf(i)] : undefined);
  return syl.map((s, i) => {
    const hz = firstChar(i);
    const accepted = new Set<Tone>([s.tone]);
    if (hz === '不') [2, 4].forEach((t) => accepted.add(t as Tone));
    if (hz === '一') [1, 2, 4].forEach((t) => accepted.add(t as Tone));
    if (s.tone === 5 && hz) citationTones(hz).forEach((t) => accepted.add(t));
    // Third-tone sandhi: 3 before 3 is spoken as 2.
    const next = syl![i + 1];
    if (s.tone === 3 && next && next.tone === 3) accepted.add(2);
    return { ...s, hanzi: hz, accepted };
  });
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function displayPinyin(exp: ExpectedPinyin): string {
  return exp.pinyin.trim();
}

/** A syllable as typed: toneless base, its tone (null if none), and the marked text. */
interface TypedSyllable {
  base: string;
  tone: Tone | null | 'conflict';
  range: [number, number];
}

/** Split typed letters into syllables; falls back to chunks between spaces and tone numbers. */
function typedSyllables(letters: Letter[]): TypedSyllable[] {
  let ranges = segmentLetters(letters, undefined, true);
  if (!ranges) {
    ranges = [];
    let start = 0;
    for (let i = 1; i <= letters.length; i++) {
      if (i === letters.length || letters[i].boundaryBefore || letters[i - 1].digit !== undefined) {
        ranges.push([start, i]);
        start = i;
      }
    }
  }
  return ranges.map((r) => ({ base: letters.slice(r[0], r[1]).map((l) => l.ch).join(''), tone: rangeTone(letters, r), range: r }));
}

function showTyped(t: TypedSyllable): string {
  const tone = t.tone === null || t.tone === 'conflict' ? 5 : t.tone;
  return markSyllable({ base: t.base, tone });
}

/**
 * Line up typed syllables with expected ones (edit distance over syllables).
 * Returns, for each expected syllable, the index of the typed syllable in its
 * place (or -1 if left out), plus the typed syllables that fit nowhere.
 */
function alignSyllables(expected: string[], typed: string[]): { pair: number[]; extra: number[] } {
  const n = expected.length;
  const m = typed.length;
  const cost = (i: number, j: number) => (expected[i] === typed[j] ? 0 : 1);
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + cost(i - 1, j - 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const pair = new Array<number>(n).fill(-1);
  const extra: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + cost(i - 1, j - 1)) {
      pair[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      i--;
    } else {
      extra.unshift(j - 1);
      j--;
    }
  }
  return { pair, extra };
}

/** Score one syllable's tone. */
function toneStatus(s: ExpectedSyllable, t: Tone | null | 'conflict'): SyllableFeedback {
  let status: SyllableStatus;
  if (t === 'conflict') status = 'wrong-tone';
  else if (t === null) status = s.tone === 5 ? 'ok' : 'missing';
  else status = s.accepted.has(t) ? 'ok' : 'wrong-tone';
  const given = status === 'ok' ? s.tone : t === 'conflict' ? null : t;
  const fb: SyllableFeedback = { expected: markSyllable(s), status, tone: s.tone, given };
  if (status === 'wrong-tone') fb.typed = markSyllable({ ...s, tone: (given ?? 5) as Tone });
  return fb;
}

function checkOne(letters: Letter[], exp: ExpectedPinyin, strict: boolean): PinyinCheck {
  const correction = displayPinyin(exp);
  const expected = buildExpected(exp);
  if (!expected) return { verdict: 'wrong', reason: 'mismatch', correction };

  const typed = letters.map((l) => l.ch).join('');
  let target = expected.map((s) => s.base + (s.erhua ? 'r' : '')).join('');
  // 儿化 is optional when typing: nǎr and nǎ both count.
  let withR = true;
  if (typed !== target && expected.some((s) => s.erhua) && typed === expected.map((s) => s.base).join('')) {
    target = typed;
    withR = false;
  }

  if (typed !== target) {
    // Some syllables differ: still score each one, so the feedback shows which.
    const mine = typedSyllables(letters);
    const { pair, extra } = alignSyllables(
      expected.map((s) => s.base + (s.erhua ? 'r' : '')),
      mine.map((t) => t.base),
    );
    const syllables = expected.map((s, i): SyllableFeedback => {
      const t = pair[i] >= 0 ? mine[pair[i]] : null;
      if (!t) return { expected: markSyllable(s), status: 'skipped', tone: s.tone, given: null };
      const same = t.base === s.base + (s.erhua ? 'r' : '') || (s.erhua && t.base === s.base);
      if (same) return toneStatus(s, t.tone);
      return { expected: markSyllable(s), status: 'wrong-syllable', tone: s.tone, given: null, typed: showTyped(t) };
    });
    const extraText = extra.map((j) => showTyped(mine[j]));
    // A one-letter slip on a long answer passes, but only if every other tone is right.
    const tonesRight = syllables.every((x) => x.status === 'ok' || x.status === 'wrong-syllable' || x.status === 'skipped');
    if (expected.length >= 4 && tonesRight && levenshtein(typed, target) <= 1) {
      return { verdict: 'typo', reason: 'typo', syllables, extra: extraText, correction };
    }
    return { verdict: 'wrong', reason: 'mismatch', syllables, extra: extraText, correction };
  }

  // Letters match: assign the user's tones using the expected syllable ranges.
  const syllables: SyllableFeedback[] = [];
  let pos = 0;
  let missing = 0;
  let wrong = 0;
  for (const s of expected) {
    const len = s.base.length + (s.erhua && withR ? 1 : 0);
    const range: [number, number] = [pos, pos + len];
    pos += len;
    const fb = toneStatus(s, rangeTone(letters, range));
    if (fb.status === 'missing') missing++;
    if (fb.status === 'wrong-tone') wrong++;
    syllables.push(fb);
  }
  if (wrong > 0) return { verdict: strict ? 'wrong' : 'almost', reason: 'wrong-tones', syllables, correction };
  if (missing > 0) return { verdict: strict ? 'wrong' : 'almost', reason: 'missing-tones', syllables, correction };
  return { verdict: 'correct', syllables, correction };
}

const RANK: Record<Verdict, number> = { correct: 3, almost: 2, typo: 1, wrong: 0 };

/**
 * Leeway for optional words: 一个 ("a") before a noun can be left out or added
 * (我有哥哥 / 我有一个哥哥). Returns the answer with 一个 removed, or null.
 */
const YIGE_PINYIN = /\by[iīíǐì][1-5]?\s*g[eēéěè][1-5]?\b\s*/i;
function withoutYige(e: ExpectedPinyin): ExpectedPinyin | null {
  if (!e.hanzi?.includes('一个') || !YIGE_PINYIN.test(e.pinyin)) return null;
  return { hanzi: e.hanzi.replace('一个', ''), pinyin: e.pinyin.replace(YIGE_PINYIN, '') };
}
/**
 * Possessive 的 after a pronoun is optional (我爸爸 / 我的爸爸). These strip it from
 * characters and from pinyin (with tone marks or numbers).
 */
const PRONOUN_HANZI = /(我们|你们|他们|她们|咱们|我|你|他|她|您)的/g;
const PRONOUN_DE = /\b((?:w[oǒ]|n[iǐ]|t[aā]|n[ií]n|z[aá]n)[0-5]?(?:\s*men[05]?)?)\s*'?de[05]?(?![a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü])/gi;
function withoutPossessiveDe(text: string): string {
  return text.replace(PRONOUN_HANZI, '$1').replace(PRONOUN_DE, '$1 ');
}
function expectedWithoutDe(e: ExpectedPinyin): ExpectedPinyin | null {
  if (!e.hanzi || !PRONOUN_HANZI.test(e.hanzi)) return null;
  PRONOUN_HANZI.lastIndex = 0;
  const pinyin = e.pinyin.replace(PRONOUN_DE, '$1 ').replace(/\s+([,.!?，。！？])/g, '$1');
  return pinyin === e.pinyin ? null : { hanzi: e.hanzi.replace(PRONOUN_HANZI, '$1'), pinyin };
}

function inputWithoutYige(input: string): string | null {
  if (input.includes('一个')) return input.replace('一个', '');
  return YIGE_PINYIN.test(input) ? input.replace(YIGE_PINYIN, '') : null;
}

/**
 * Words that mean the same in everyday speech: any of these swaps in the
 * expected answer is accepted too (Beijing and standard forms, polite and plain "you").
 */
const SWAPS: Array<[string, string, string, string]> = [
  // hanzi, pinyin, hanzi, pinyin
  ['您', 'nín', '你', 'nǐ'],
  ['咱们', 'zánmen', '我们', 'wǒmen'],
  ['哪儿', 'nǎr', '哪里', 'nǎlǐ'],
  ['这儿', 'zhèr', '这里', 'zhèlǐ'],
  ['那儿', 'nàr', '那里', 'nàlǐ'],
  ['一点儿', 'yìdiǎnr', '一点', 'yìdiǎn'],
  ['一会儿', 'yíhuìr', '一会', 'yíhuì'],
];

function swapOnce(e: ExpectedPinyin, fromH: string, fromP: string, toH: string, toP: string): ExpectedPinyin | null {
  if (!e.hanzi?.includes(fromH)) return null;
  const re = new RegExp(`(^|[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü])${fromP}(?![a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü])`, 'i');
  const m = e.pinyin.match(re);
  if (!m) return null;
  const start = m.index! + m[1].length;
  const orig = e.pinyin.slice(start, start + fromP.length);
  const to = orig[0] === orig[0].toUpperCase() ? toP[0].toUpperCase() + toP.slice(1) : toP;
  return { hanzi: e.hanzi.replace(fromH, toH), pinyin: e.pinyin.slice(0, start) + to + e.pinyin.slice(start + fromP.length) };
}

/** Versions of the answer with equivalent words swapped in (one swap each, plus all at once). */
function equivalents(e: ExpectedPinyin): ExpectedPinyin[] {
  const out: ExpectedPinyin[] = [];
  let forward: ExpectedPinyin = e; // 您→你, 咱们→我们, 哪儿→哪里…
  let backward: ExpectedPinyin = e; // and the other way round
  for (const [h1, p1, h2, p2] of SWAPS) {
    const f = swapOnce(e, h1, p1, h2, p2);
    const b = swapOnce(e, h2, p2, h1, p1);
    if (f) out.push(f);
    if (b) out.push(b);
    forward = swapOnce(forward, h1, p1, h2, p2) ?? forward;
    backward = swapOnce(backward, h2, p2, h1, p1) ?? backward;
  }
  if (forward !== e) out.push(forward);
  if (backward !== e) out.push(backward);
  return out;
}

export function checkPinyinAnswer(input: string, expected: ExpectedPinyin, opts: CheckOptions = {}): PinyinCheck {
  const strict = checkExact(input, expected, opts);
  if (strict.verdict === 'correct') return strict;
  // Leeway: equivalent words (您/你, 哪儿/哪里…), and 一个 left out or added. Accepted, with the main answer shown.
  const variants: Array<[string, ExpectedPinyin]> = [];
  for (const v of equivalents(expected)) variants.push([input, v]);
  const shorter = withoutYige(expected);
  if (shorter) variants.push([input, shorter]);
  const noDe = expectedWithoutDe(expected);
  if (noDe) variants.push([input, noDe]);
  const inputNoDe = withoutPossessiveDe(input);
  if (inputNoDe !== input) variants.push([inputNoDe, expected]);
  const trimmed = inputWithoutYige(input);
  if (trimmed && trimmed.trim()) variants.push([trimmed, expected]);
  let best = strict;
  for (const [inp, exp] of variants) {
    const r = checkExact(inp, exp, opts);
    if (RANK[r.verdict] > RANK[best.verdict]) best = { ...r, correction: strict.correction, otherAnswer: expected.hanzi };
    if (best.verdict === 'correct') break;
  }
  return best;
}

function checkExact(input: string, expected: ExpectedPinyin, opts: CheckOptions): PinyinCheck {
  const correction = displayPinyin(expected);
  const candidates = [expected, ...(opts.alternatives ?? [])];

  // Typed in characters with an IME? Accept an exact match.
  const typedHanzi = hanziOnly(input);
  if (typedHanzi) {
    const hit = candidates.some((c) => c.hanzi && hanziOnly(c.hanzi) === typedHanzi);
    if (hit) return { verdict: 'correct', correction };
    const near = candidates.find((c) => c.hanzi && sameSound(hanziOnly(c.hanzi)) === sameSound(typedHanzi));
    if (near) return { verdict: 'correct', correction, otherAnswer: near.hanzi };
    return { verdict: 'wrong', reason: 'mismatch', correction };
  }

  const letters = toLetters(input);
  if (letters.length === 0) return { verdict: 'wrong', reason: 'empty', correction };

  let best: PinyinCheck | null = null;
  for (const c of candidates) {
    const r = checkOne(letters, c, opts.strictTones ?? true);
    if (!best || RANK[r.verdict] > RANK[best.verdict]) best = r;
    if (r.verdict === 'correct') break;
  }
  // Always show the main answer as the correction unless an alternative was matched exactly.
  return best!.verdict === 'wrong' ? { ...best!, correction } : best!;
}

/** The FSRS grade an answer earns: right → Good, tone slip in lenient mode → Hard, wrong → Again. */
export function gradeOf(v: Verdict): 'again' | 'hard' | 'good' {
  return v === 'correct' || v === 'typo' ? 'good' : v === 'almost' ? 'hard' : 'again';
}

/** True when the verdict should count as a pass for progress. */
export function isPass(v: Verdict): boolean {
  return v === 'correct' || v === 'typo' || v === 'almost';
}
