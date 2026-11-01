/**
 * Grammar topics (Library → Grammar): how sentences are built, to read, with
 * exercises. Content: content/grammar/*.json (one file per HSK band).
 *
 * Sentences are written as tokens: "我/wǒ 喝/hē 茶/chá 。". A token with a
 * slash is a word (characters/pinyin); "_" is the blank in a choose exercise;
 * anything else is punctuation or plain text. Example i of topic t is recorded
 * with Azure as `gr-<t>-<i>`, exercise i's sentence as `gr-<t>-x<i>`.
 */
export type Token = { h: string; p: string } | { plain: string } | { blank: true };

export interface Example {
  t: string;
  en: string;
  note?: string;
}
export interface Mistake {
  wrong: string;
  right: string;
  why: string;
}
export type Exercise =
  | { type: 'order'; t: string; en: string; alt?: string[] }
  | { type: 'choose'; t: string; en: string; options: string[]; answer: number; why?: string }
  | { type: 'spot'; en: string; options: string[]; answer: number; why?: string };

export interface Topic {
  id: string;
  level: number;
  title: string;
  summary: string;
  pattern: string;
  text: string[];
  examples: Example[];
  mistakes?: Mistake[];
  exercises: Exercise[];
}

export type TopicFile = { level: number; topics: Array<Omit<Topic, 'level'>> };

/** Topics of the content files, in file order (no I/O: the app and the Azure script load the files their own way). */
export function topicsOf(files: TopicFile[]): Topic[] {
  return files.flatMap((f) => f.topics.map((t) => ({ ...t, level: f.level })));
}

export function tokens(line: string): Token[] {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .map((w): Token => {
      if (w === '_') return { blank: true };
      const i = w.indexOf('/');
      return i > 0 ? { h: w.slice(0, i), p: w.slice(i + 1) } : { plain: w };
    });
}

const PUNCT: Record<string, string> = { '。': '.', '，': ',', '？': '?', '！': '!', '、': ',', '：': ':', '；': ';' };

/** The pinyin of a token line ("Wǒ hē chá."), with "___" for the blank. */
export function pinyinOf(line: string | Token[], sentence = true): string {
  const out: string[] = [];
  for (const t of typeof line === 'string' ? tokens(line) : line) {
    if ('blank' in t) out.push('___');
    else if ('p' in t) out.push(t.p);
    else {
      const p = [...t.plain].map((c) => PUNCT[c] ?? c).join('');
      if (out.length && /^[.,?!:;]+$/.test(p)) out[out.length - 1] += p;
      else out.push(p);
    }
  }
  const s = out.join(' ');
  // A sentence starts with a capital; a word or phrase (an option) doesn't.
  return sentence && /[.?!]$/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The characters of a token line ("我喝茶。"), with "＿" for the blank. */
export function hanziOf(line: string | Token[]): string {
  return (typeof line === 'string' ? tokens(line) : line).map((t) => ('blank' in t ? '＿' : 'h' in t ? t.h : t.plain)).join('');
}

/** The words of a sentence, without punctuation (the tiles of an order exercise). */
export function wordsOf(line: string): Array<{ h: string; p: string }> {
  return tokens(line).filter((t): t is { h: string; p: string } => 'h' in t);
}

/** The sentence a choose exercise means, with the right option filled in. */
export function filledIn(ex: Extract<Exercise, { type: 'choose' }>): string {
  return ex.t.replace(/(^|\s)_(?=\s|$)/, `$1${ex.options[ex.answer]}`);
}

/** The full right sentence of an exercise (for its answer and recording). */
export function sentenceOf(ex: Exercise): string {
  return ex.type === 'order' ? ex.t : ex.type === 'choose' ? filledIn(ex) : ex.options[ex.answer];
}

/** What is read aloud: without stage directions in brackets, and "=" as a pause. */
export function spokenLine(line: string): string {
  return line
    .replace(/（[^）]*）/g, ' ')
    .replace(/(^|\s)=(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const exampleAudioId = (topic: string, i: number) => `gr-${topic}-${i}`;
export const exerciseAudioId = (topic: string, i: number) => `gr-${topic}-x${i}`;

/** Review card for a topic (scheduled with FSRS; questions come in sessions when due). */
export const grammarCardId = (topic: string) => `gram-${topic}`;
export const GRAMMAR_CARD = /^gram-/;
export const topicOfCard = (id: string) => (GRAMMAR_CARD.test(id) ? id.slice(5) : null);

/** Is an order answer right? The sentence's own order or one of its alternatives (compared by characters). */
export function orderIsRight(ex: Extract<Exercise, { type: 'order' }>, picked: Array<{ h: string }>): boolean {
  const got = picked.map((w) => w.h).join('');
  return [ex.t, ...(ex.alt ?? [])].some((s) => wordsOf(s).map((w) => w.h).join('') === got);
}

/** Pure: a shuffle that never returns the right order (for tiles), unless there's only one way. */
export function shuffled<T>(items: T[], rng: () => number = Math.random, same: (a: T[]) => boolean = () => false): T[] {
  for (let k = 0; k < 8; k++) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (!same(a) || items.length < 2) return a;
  }
  return [...items].reverse();
}

/** Grade for a topic's practice from the share right: all right Good, one slip Hard, else Again. */
export function practiceRating(right: number, total: number): 'again' | 'hard' | 'good' {
  if (total === 0) return 'good';
  if (right === total) return 'good';
  return total - right <= 1 ? 'hard' : 'again';
}
