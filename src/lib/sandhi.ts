/**
 * Tone changes in a sentence (IDEAS #4): 3rd + 3rd, 不 and 一. Typed answers
 * keep dictionary tones; this only explains what you hear. Rules are the
 * usual textbook ones (a run of 3rd tones: all but the last are said as 2nd).
 * 3rd + 3rd is only applied inside a written pinyin word, or where one side is
 * a one-syllable word (我想, 很好): between two longer words (发展 美元) it
 * depends on phrasing, so we stay quiet.
 */
import { alignToHanzi, isHanzi, markSyllable, parsePinyin, type Tone } from './pinyin';

export interface SandhiChange {
  /** Dictionary tones, e.g. "nǐ hǎo". */
  from: string;
  /** As spoken, e.g. "ní hǎo". */
  to: string;
}

export interface SentenceSandhi {
  changes: SandhiChange[];
  /** One short rule per kind of change found. */
  rules: string[];
}

const RULE = {
  three: 'A 3rd tone before another 3rd is said as a 2nd.',
  bu: '不 before a 4th tone is said bú.',
  yi4: '一 before a 4th tone is said yí.',
  yiOther: '一 before a 1st, 2nd or 3rd tone is said yì.',
};

const NUMERAL = new Set([...'零〇一二三四五六七八九十百千万亿两']);

export function sentenceSandhi(hanzi: string, pinyin: string): SentenceSandhi | null {
  const al = alignToHanzi(hanzi, pinyin);
  if (!al) return null;
  const { syls, chars, charSyl } = al;
  // Punctuation between characters ends a phrase: no changes across it.
  const breakAfter = new Set<number>();
  let k = -1;
  for (const ch of hanzi) {
    if (isHanzi(ch)) k++;
    else if (k >= 0 && !/\s/.test(ch)) breakAfter.add(k);
  }
  // Syllable i → its first character (for 不/一 and phrase breaks).
  const charOf: number[] = [];
  charSyl.forEach((s, ci) => {
    if (charOf[s] === undefined) charOf[s] = ci;
  });
  const lastChar = (s: number) => charSyl.lastIndexOf(s);
  const joined = (s: number) => !breakAfter.has(lastChar(s));

  // Which written pinyin word each syllable belongs to, and that word's length.
  const wordOf: number[] = [];
  const wordLen: number[] = [];
  for (const token of pinyin.split(/\s+/)) {
    const clean = token.replace(/[^\p{L}\p{M}'0-9:]/gu, '');
    if (!clean) continue;
    const n = parsePinyin(clean)?.length ?? 0;
    for (let j = 0; j < n; j++) wordOf.push(wordLen.length);
    wordLen.push(n);
  }
  const wordsKnown = wordOf.length === syls.length;
  const threeThree = (i: number) =>
    !wordsKnown || wordOf[i] === wordOf[i + 1] || wordLen[wordOf[i]] === 1 || wordLen[wordOf[i + 1]] === 1;

  const spoken: Tone[] = syls.map((s) => s.tone);
  const rules = new Set<string>();
  for (let i = 0; i + 1 < syls.length; i++) {
    if (!joined(i) || syls[i].erhua) continue;
    const a = syls[i].tone;
    const b = syls[i + 1].tone;
    const ch = chars[charOf[i]];
    if (a === 3 && b === 3) {
      if (!threeThree(i)) continue;
      spoken[i] = 2;
      rules.add(RULE.three);
    } else if (ch === '不' && a === 4 && b === 4) {
      spoken[i] = 2;
      rules.add(RULE.bu);
    } else if (ch === '一' && a === 1 && b !== 5) {
      const prev = chars[charOf[i] - 1];
      const next = chars[charOf[i + 1]];
      // Counting and ordinals keep yī: 第一, 十一, 一二三.
      if (prev === '第' || NUMERAL.has(prev ?? '') || NUMERAL.has(next ?? '')) continue;
      spoken[i] = b === 4 ? 2 : 4;
      rules.add(b === 4 ? RULE.yi4 : RULE.yiOther);
    }
  }
  // Group each changed syllable with the next one; merge touching groups.
  const changes: SandhiChange[] = [];
  let i = 0;
  while (i < syls.length) {
    if (spoken[i] === syls[i].tone) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end + 1 < syls.length && spoken[end] !== syls[end].tone) end++;
    const span = syls.slice(i, end + 1);
    changes.push({
      from: span.map((s) => markSyllable(s)).join(' '),
      to: span.map((s, j) => markSyllable({ ...s, tone: spoken[i + j] })).join(' '),
    });
    i = end + 1;
  }
  return changes.length ? { changes, rules: [...rules] } : null;
}
