/**
 * Live tone marks while typing: "ni3" becomes "nǐ" the moment the 3 is typed,
 * "nv3" becomes "nǚ", and "u:" becomes "ü". A 5 or 0 (neutral tone) just
 * removes the number. Anything that isn't a valid syllable is left alone.
 */
import { isValidSyllable, markSyllable, toLetters, type Tone } from './pinyin';

const LETTERS = /[a-zA-ZüÜvVāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ]+$/;

export interface LiveResult {
  value: string;
  caret: number;
}

/** Apply live conversion after an edit. `caret` is the cursor position after the edit. */
export function liveToneMarks(value: string, caret: number): LiveResult {
  // u: → ü anywhere (keeps the caret in place relative to the text).
  let v = value;
  let c = caret;
  for (let i = v.indexOf('u:'); i >= 0; i = v.indexOf('u:', i)) {
    v = v.slice(0, i) + 'ü' + v.slice(i + 2);
    if (c > i) c -= 1;
  }
  for (let i = v.indexOf('U:'); i >= 0; i = v.indexOf('U:', i)) {
    v = v.slice(0, i) + 'Ü' + v.slice(i + 2);
    if (c > i) c -= 1;
  }

  const digit = v[c - 1];
  if (!digit || !/[0-5]/.test(digit)) return { value: v, caret: c };
  const before = v.slice(0, c - 1);
  const run = before.match(LETTERS)?.[0];
  if (!run) return { value: v, caret: c };

  // The syllable the number belongs to: the longest valid syllable at the end of the letters.
  const letters = toLetters(run);
  if (letters.length !== [...run].length) return { value: v, caret: c };
  const base = letters.map((l) => l.ch).join('');
  let len = 0;
  for (let k = Math.min(6, base.length); k >= 1; k--) {
    if (isValidSyllable(base.slice(-k))) {
      len = k;
      break;
    }
  }
  if (!len) return { value: v, caret: c };

  const tone = (digit === '0' ? 5 : Number(digit)) as Tone;
  const chars = [...run];
  const original = chars.slice(-len).join('');
  let marked = markSyllable({ base: base.slice(-len), tone });
  if (/^\p{Lu}/u.test(original)) marked = marked[0].toUpperCase() + marked.slice(1);
  const start = before.length - original.length;
  const out = v.slice(0, start) + marked + v.slice(c);
  return { value: out, caret: start + marked.length };
}
