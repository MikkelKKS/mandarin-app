/**
 * Reading stories: short original texts built from the words of the units
 * before them. A few extra words (with glosses) are allowed per story.
 * Pure helpers here are shared by the app and the content validator.
 */
import { z } from 'zod';
import { isHanzi } from '../lib/pinyin';

export const StorySchema = z.object({
  id: z.string().regex(/^r-[a-z0-9-]+$/),
  title: z.string().min(1),
  titleHanzi: z.string().min(1),
  /** Unit after which the story makes sense (all its words are taught by then). */
  after: z.string(),
  blurb: z.string().min(1),
  paragraphs: z.array(z.object({ zh: z.string().min(1), en: z.string().min(1) })).min(1),
  /** Words the units don't teach, shown with a gloss when tapped. */
  extra: z.array(z.object({ hanzi: z.string().min(1), pinyin: z.string().min(1), english: z.string().min(1) })).default([]),
});
export type Story = z.infer<typeof StorySchema>;

export interface StoryToken {
  text: string;
  /** Hanzi of the vocabulary item, or undefined for punctuation and spaces. */
  word?: string;
}

/** Greedy longest-match split of text into known vocabulary items. Unknown characters come out one by one with word = undefined... marked in `unknown`. */
export function segmentWithVocab(text: string, vocab: Set<string>): { tokens: StoryToken[]; unknown: string[] } {
  const maxLen = Math.min(8, Math.max(1, ...[...vocab].map((v) => [...v].length)));
  const chars = [...text];
  const tokens: StoryToken[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      tokens.push({ text: chars.slice(i, j).join('') });
      i = j;
      continue;
    }
    let len = 0;
    for (let l = Math.min(maxLen, chars.length - i); l >= 1; l--) {
      if (vocab.has(chars.slice(i, i + l).join(''))) {
        len = l;
        break;
      }
    }
    if (len === 0) {
      unknown.push(chars[i]);
      tokens.push({ text: chars[i], word: chars[i] });
      i++;
    } else {
      const w = chars.slice(i, i + len).join('');
      tokens.push({ text: w, word: w });
      i += len;
    }
  }
  return { tokens, unknown };
}

interface UnitLike {
  id: string;
  order: number;
  words: Array<{ hanzi: string }>;
}

/** Hanzi of every word taught up to and including `unitId`. */
export function vocabUpTo(units: UnitLike[], unitId: string): Set<string> | null {
  const target = units.find((u) => u.id === unitId);
  if (!target) return null;
  const v = new Set<string>();
  for (const u of units) if (u.order <= target.order) for (const w of u.words) v.add(w.hanzi);
  return v;
}

/** Validation for one story file. */
export function checkStory(file: string, raw: unknown, units: UnitLike[]): string[] {
  const parsed = StorySchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `${file}: ${i.path.join('.')}: ${i.message}`);
  const s = parsed.data;
  const errors: string[] = [];
  if (JSON.stringify(raw).includes('—')) errors.push(`${file}: contains an em dash (—).`);
  const vocab = vocabUpTo(units, s.after);
  if (!vocab) return [`${file}: unknown unit "${s.after}" in "after"`];
  for (const e of s.extra) vocab.add(e.hanzi);
  const unknown = new Set<string>();
  for (const p of [s.titleHanzi, ...s.paragraphs.map((x) => x.zh)]) for (const c of segmentWithVocab(p, vocab).unknown) unknown.add(c);
  if (unknown.size) errors.push(`${file}: characters not taught by "${s.after}" (add them to "extra" or rephrase): ${[...unknown].join(' ')}`);
  return errors;
}
