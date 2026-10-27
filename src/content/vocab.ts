/**
 * The big vocabulary: every HSK 3.0 term plus the words of the hand-written
 * course, and example sentences (Tatoeba, the course, or generated).
 * Built by scripts/build-vocab.ts into content/data/*.json.
 * Pure helpers here are shared by the build script, the validator and the app.
 */
import { z } from 'zod';
import { isHanzi, markSyllable, type Tone } from '../lib/pinyin';

export const VocabWordSchema = z.object({
  /** Stable id from the characters and the reading, e.g. "ba4ba5-1x0f3". */
  id: z.string().regex(/^[a-z0-9]+-[a-z0-9]{5}$/),
  hanzi: z.string().min(1),
  /** Traditional form(s), only when different. */
  trad: z.string().optional(),
  /** Tone marks, syllables separated by spaces: "bà ba". */
  pinyin: z.string().min(1),
  /** Tone numbers, lower case, ü as v, syllables separated by spaces: "ba4 ba5", "nv3 er2". */
  numeric: z.string().regex(/^[a-z]+[1-5]( [a-z]+[1-5])*$/),
  /** HSK 3.0 level: 1 to 6, 7 for the joint 7 to 9 band, 0 for words only the course has. */
  level: z.number().int().min(0).max(7),
  /** Position in the learning order (level, then frequency). 1 = first. */
  order: z.number().int().positive(),
  /** HSK 3.0 list id, e.g. "L1-0004". */
  hsk: z.string().optional(),
  pos: z.array(z.string()),
  gloss: z.array(z.string()),
  classifiers: z.array(z.string()).optional(),
  /** Corpus frequency rank (1 = most common), when known. */
  freq: z.number().int().positive().optional(),
  /** Example sentence ids, best first. */
  examples: z.array(z.string()),
  /** Ids this word had in the hand-written course, so old progress carries over. */
  legacy: z.array(z.string()).optional(),
});
export type VocabWord = z.infer<typeof VocabWordSchema>;

export const VocabSentenceSchema = z.object({
  /** "t<tatoeba id>", a course id ("s-…"), or "g-…" for generated ones. */
  id: z.string().min(1),
  hanzi: z.string().min(1),
  /** Tone marks, one group per word, punctuation kept: "wǒ ài nǐ." */
  pinyin: z.string().min(1),
  english: z.array(z.string().min(1)).min(1),
  /** Word ids in order (punctuation and names left out). */
  words: z.array(z.string()),
  /** Order of the hardest word: the sentence only uses words learned by then. */
  unlocks: z.number().int().nonnegative(),
  source: z.enum(['tatoeba', 'course', 'generated']),
  /** Tatoeba: who wrote the Chinese and the English (CC BY 2.0 FR). */
  by: z.object({ zh: z.string(), en: z.string(), en_id: z.number().int() }).optional(),
});
export type VocabSentence = z.infer<typeof VocabSentenceSchema>;

/** FNV-1a over code points, as 5 base-36 characters. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 36 ** 5).toString(36).padStart(5, '0');
}

/** Stable word id: the reading without spaces plus a hash of characters and reading. */
export function wordId(hanzi: string, numeric: string): string {
  const reading = numeric.toLowerCase().replace(/u:/g, 'v').replace(/[^a-z0-9]/g, '');
  return `${reading}-${shortHash(`${hanzi}|${reading}`)}`;
}

/**
 * CC-CEDICT style tone numbers to marks, one syllable per space-separated
 * group: "ni3 hao3" → "nǐ hǎo", "lu:4" → "lǜ". A trailing "r5" (儿化) joins
 * the syllable before it: "yi1 dian3 r5" → "yī diǎnr".
 */
export function numericToMarks(numeric: string): string {
  const out: string[] = [];
  for (const tok of numeric.trim().split(/\s+/)) {
    const m = tok.match(/^([A-Za-z:]+)([1-5])$/);
    if (!m) {
      out.push(tok);
      continue;
    }
    const base = m[1].toLowerCase().replace(/u:/g, 'v');
    if (base === 'r' && m[2] === '5' && out.length) {
      out[out.length - 1] += 'r';
      continue;
    }
    let marked = markSyllable({ base, tone: Number(m[2]) as Tone });
    if (/^[A-Z]/.test(m[1])) marked = marked[0].toUpperCase() + marked.slice(1);
    out.push(marked);
  }
  return out.join(' ');
}

export interface Token {
  text: string;
  /** Key into the vocabulary map; undefined for punctuation, spaces and unknown characters. */
  key?: string;
  /** True for a hanzi that matched nothing. */
  unknown?: boolean;
}

/**
 * Greedy longest-match split of Chinese text into vocabulary items.
 * `vocab` holds the hanzi of every known item; `maxLen` caps the match length.
 */
export function tokenize(text: string, vocab: ReadonlySet<string>, maxLen = 8): Token[] {
  const chars = [...text];
  const out: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      out.push({ text: chars.slice(i, j).join('') });
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
    if (!len) {
      out.push({ text: chars[i], unknown: true });
      i++;
    } else {
      const w = chars.slice(i, i + len).join('');
      out.push({ text: w, key: w });
      i += len;
    }
  }
  return out;
}

const PUNCT: Record<string, string> = { '，': ',', '。': '.', '？': '?', '！': '!', '：': ':', '；': ';', '、': ',', '“': '"', '”': '"', '…': '…', '（': '(', '）': ')' };

/** Sentence pinyin from tokens: each word's own pinyin (syllables joined), punctuation in Latin form, first letter capitalised. */
export function sentencePinyin(tokens: Array<{ text: string; pinyin?: string }>): string {
  let s = '';
  for (const t of tokens) {
    if (t.pinyin) s += (s && !/[(“"]$/.test(s) ? ' ' : '') + t.pinyin.replace(/ /g, '');
    else {
      const p = [...t.text.trim()].map((c) => PUNCT[c] ?? c).join('');
      s += p;
    }
  }
  s = s.trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Clean CC-CEDICT definitions for display: drop classifier notes and pure cross-references. */
export function cleanGlosses(defs: string[], max = 4): string[] {
  const keep = defs
    .map((d) => d.trim())
    .filter((d) => d && !/^CL:/.test(d) && !/^(old |erhua )?variant of /.test(d) && !/^see [^ ]+\[/.test(d) && !/^also written /.test(d) && !/^abbr\. for /.test(d))
    .map((d) => d.replace(/\[[a-zA-Z0-9: ]+\]/g, '').replace(/[^\s|]+\|([^\s|]+)/g, '$1').trim());
  const out = keep.length ? keep : defs.filter((d) => !/^CL:/.test(d)).map((d) => d.trim());
  return [...new Set(out)].slice(0, max);
}

/** Classifiers named in a CEDICT "CL:個|个[ge4],本[ben3]" note, simplified forms. */
export function classifiersFrom(defs: string[]): string[] {
  const out: string[] = [];
  for (const d of defs) {
    const m = d.match(/^CL:(.*)$/);
    if (!m) continue;
    for (const part of m[1].split(',')) {
      const h = part.replace(/\[.*$/, '').split('|').pop()!.trim();
      if (h) out.push(h);
    }
  }
  return [...new Set(out)];
}

/** Consistency checks for words.json + sentences.json. Returns error messages. */
export function checkVocab(rawWords: unknown[], rawSentences: unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  const words: VocabWord[] = [];
  for (const raw of rawWords) {
    const r = VocabWordSchema.safeParse(raw);
    if (!r.success) {
      errors.push(`words.json: ${JSON.stringify(raw).slice(0, 60)}…: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const w = r.data;
    if (ids.has(w.id)) errors.push(`words.json: duplicate id ${w.id}`);
    if (orders.has(w.order)) errors.push(`words.json: duplicate order ${w.order} (${w.hanzi})`);
    if (w.id !== wordId(w.hanzi, w.numeric)) errors.push(`words.json: id ${w.id} doesn't match ${w.hanzi} ${w.numeric}`);
    if (numericToMarks(w.numeric).toLowerCase() !== w.pinyin.toLowerCase()) errors.push(`words.json: ${w.id} pinyin "${w.pinyin}" doesn't match "${w.numeric}"`);
    ids.add(w.id);
    orders.add(w.order);
    words.push(w);
  }
  const sentenceIds = new Set<string>();
  for (const raw of rawSentences) {
    const r = VocabSentenceSchema.safeParse(raw);
    if (!r.success) {
      errors.push(`sentences.json: ${JSON.stringify(raw).slice(0, 60)}…: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const s = r.data;
    if (sentenceIds.has(s.id)) errors.push(`sentences.json: duplicate id ${s.id}`);
    sentenceIds.add(s.id);
    for (const w of s.words) if (!ids.has(w)) errors.push(`sentences.json: ${s.id} uses unknown word ${w}`);
    if (s.source === 'tatoeba' && !s.by) errors.push(`sentences.json: ${s.id} has no Tatoeba attribution`);
  }
  for (const w of words) for (const e of w.examples) if (!sentenceIds.has(e)) errors.push(`words.json: ${w.id} example ${e} is missing`);
  return errors;
}
