/**
 * Checks a typed pinyin answer against the expected answer.
 *
 * Accepts tone marks, tone numbers (0/5 = neutral), v or u: for ü, any case,
 * any spacing and punctuation. Lenient about 不/一 tone changes and third-tone
 * sandhi. Missing tones are a soft error ("almost") unless strict mode is on.
 * One-letter slips on long answers pass as "typo" with the correction shown.
 */
import citation from 'virtual:citation-tones';
import {
  type Letter,
  type Syllable,
  type Tone,
  hanziOnly,
  markSyllable,
  parsePinyin,
  rangeTone,
  toLetters,
} from './pinyin';

export type Verdict = 'correct' | 'almost' | 'typo' | 'wrong';

export interface ExpectedPinyin {
  pinyin: string; // with tone marks, as written in content
  hanzi?: string; // used for 不/一 and neutral-tone leniency
}

export interface SyllableFeedback {
  expected: string; // marked syllable, e.g. "hǎo"
  status: 'ok' | 'missing' | 'wrong-tone';
}

export interface PinyinCheck {
  verdict: Verdict;
  reason?: 'missing-tones' | 'wrong-tones' | 'typo' | 'mismatch' | 'empty';
  syllables?: SyllableFeedback[];
  /** The answer to show as the correct version. */
  correction: string;
}

export interface CheckOptions {
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
  const chars = exp.hanzi ? [...hanziOnly(exp.hanzi)] : [];
  let syl = chars.length ? parsePinyin(exp.pinyin, chars.length) : null;
  const aligned = !!syl;
  if (!syl) syl = parsePinyin(exp.pinyin);
  if (!syl) return null;
  return syl.map((s, i) => {
    const hz = aligned ? chars[i] : undefined;
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

function checkOne(letters: Letter[], exp: ExpectedPinyin, strict: boolean): PinyinCheck {
  const correction = displayPinyin(exp);
  const expected = buildExpected(exp);
  if (!expected) return { verdict: 'wrong', reason: 'mismatch', correction };

  const typed = letters.map((l) => l.ch).join('');
  const target = expected.map((s) => s.base).join('');

  if (typed !== target) {
    if (expected.length >= 4 && levenshtein(typed, target) <= 1) {
      return { verdict: 'typo', reason: 'typo', correction };
    }
    return { verdict: 'wrong', reason: 'mismatch', correction };
  }

  // Letters match: assign the user's tones using the expected syllable ranges.
  const syllables: SyllableFeedback[] = [];
  let pos = 0;
  let missing = 0;
  let wrong = 0;
  for (const s of expected) {
    const range: [number, number] = [pos, pos + s.base.length];
    pos += s.base.length;
    const t = rangeTone(letters, range);
    let status: SyllableFeedback['status'];
    if (t === 'conflict') status = 'wrong-tone';
    else if (t === null) status = s.tone === 5 ? 'ok' : 'missing';
    else status = s.accepted.has(t) ? 'ok' : 'wrong-tone';
    if (status === 'missing') missing++;
    if (status === 'wrong-tone') wrong++;
    syllables.push({ expected: markSyllable(s), status });
  }
  if (wrong > 0) return { verdict: 'wrong', reason: 'wrong-tones', syllables, correction };
  if (missing > 0) {
    return { verdict: strict ? 'wrong' : 'almost', reason: 'missing-tones', syllables, correction };
  }
  return { verdict: 'correct', syllables, correction };
}

const RANK: Record<Verdict, number> = { correct: 3, almost: 2, typo: 1, wrong: 0 };

export function checkPinyinAnswer(input: string, expected: ExpectedPinyin, opts: CheckOptions = {}): PinyinCheck {
  const correction = displayPinyin(expected);
  const candidates = [expected, ...(opts.alternatives ?? [])];

  // Typed in characters with an IME? Accept an exact match.
  const typedHanzi = hanziOnly(input);
  if (typedHanzi) {
    const hit = candidates.some((c) => c.hanzi && hanziOnly(c.hanzi) === typedHanzi);
    return hit ? { verdict: 'correct', correction } : { verdict: 'wrong', reason: 'mismatch', correction };
  }

  const letters = toLetters(input);
  if (letters.length === 0) return { verdict: 'wrong', reason: 'empty', correction };

  let best: PinyinCheck | null = null;
  for (const c of candidates) {
    const r = checkOne(letters, c, !!opts.strictTones);
    if (!best || RANK[r.verdict] > RANK[best.verdict]) best = r;
    if (r.verdict === 'correct') break;
  }
  // Always show the main answer as the correction unless an alternative was matched exactly.
  return best!.verdict === 'wrong' ? { ...best!, correction } : best!;
}

/** True when the verdict should count as a pass for progress. */
export function isPass(v: Verdict): boolean {
  return v === 'correct' || v === 'typo' || v === 'almost';
}
