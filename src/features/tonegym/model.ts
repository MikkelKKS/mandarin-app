/**
 * Tone Gym (CLAUDE.md §3.2): short rounds of tone ear-training with several
 * speakers, adapting to the tones and tone pairs you confuse most.
 * Pure logic here; the screen is ToneGym.tsx.
 */
import tonePerfect from '../../../content/data/tone-perfect.json';
import { parsePinyin, markSyllable, type Tone } from '../../lib/pinyin';
import type { VocabRow } from '../../lib/vocabData';

/** Tone Perfect (MSU Libraries, CC BY-NC 4.0): syllable → tone → speakers recorded. */
const TP = tonePerfect as Record<string, Record<string, string[]>>;
const TP_SPEAKERS: Record<string, string> = { f1: 'Woman 1', f2: 'Woman 2', f3: 'Woman 3', m1: 'Man 1', m2: 'Man 2', m3: 'Man 3' };

export type GymMode = 'mixed' | 'single' | 'pairs' | 'sandhi';
/** The Tone Gym uses real recordings only (Tone Perfect), so single tones: an adaptive workout and an even mix. */
export const MODES: Array<{ id: GymMode; title: string; blurb: string }> = [
  { id: 'mixed', title: 'Workout', blurb: 'Weighted to the tones you mix up most' },
  { id: 'single', title: 'Even mix', blurb: 'All four tones equally, any syllable' },
];
export const ROUND = 20;

export interface GymSource {
  url: string;
  /** Who is speaking, for "another voice". */
  speaker: string;
}

export interface GymItem {
  word: string;
  hanzi: string;
  /** Dictionary pinyin with tone marks. */
  pinyin: string;
  /** Toneless syllables (v for ü). */
  bases: string[];
  /** Dictionary tones, one per syllable (5 = neutral). */
  tones: Tone[];
  /** Pattern key: "3" for one syllable, "2-3" for two. */
  pattern: string;
  /** How it's actually spoken, when a tone changes (3+3, 不, 一). */
  sandhi?: { spoken: string; why: string };
  /** Recordings by different speakers. */
  sources: GymSource[];
  gloss: string;
}

/** Recordings for a word: the new Azure voice, plus the older two voices for course words. */
export function sourcesFor(w: Pick<VocabRow, 'id' | 'azure' | 'course'>, base: string): GymSource[] {
  const out: GymSource[] = [];
  if (w.azure) out.push({ url: `${base}audio/az/${w.id}.mp3`, speaker: 'Xiaoxiao' });
  if (w.course) {
    out.push({ url: `${base}audio/m/${w.course}.mp3`, speaker: 'Yunxi' });
    if (!w.azure) out.push({ url: `${base}audio/f/${w.course}.mp3`, speaker: 'Xiaoxiao (older recording)' });
  }
  return out;
}

const mark = (base: string, tone: Tone) => markSyllable({ base, tone });

/** Spoken form and explanation when tones change in context. */
export function sandhiOf(hanzi: string, bases: string[], tones: Tone[]): GymItem['sandhi'] {
  if (tones.length !== 2) return undefined;
  const [a, b] = tones;
  const chars = [...hanzi];
  if (a === 3 && b === 3)
    return { spoken: `${mark(bases[0], 2)} ${mark(bases[1], 3)}`, why: 'A 3rd tone before another 3rd tone is said as a 2nd tone.' };
  if (chars[0] === '不' && b === 4) return { spoken: `${mark(bases[0], 2)} ${mark(bases[1], 4)}`, why: '不 before a 4th tone is said bú.' };
  if (chars[0] === '一' && a === 1 && b !== 5) {
    const t: Tone = b === 4 ? 2 : 4;
    return {
      spoken: `${mark(bases[0], t)} ${mark(bases[1], b)}`,
      why: b === 4 ? '一 before a 4th tone is said yí.' : '一 before a 1st, 2nd or 3rd tone is said yì.',
    };
  }
  return undefined;
}

/** A word becomes a Tone Gym item if it has recordings and one or two plain syllables. */
export function toItem(w: VocabRow, base: string): GymItem | null {
  const sources = sourcesFor(w, base);
  if (!sources.length) return null;
  const syl = parsePinyin(w.pinyin.replace(/\s+/g, ''), [...w.hanzi].length);
  if (!syl || syl.some((s) => s.erhua) || syl.length !== [...w.hanzi].length) return null;
  if (syl.length === 1 && syl[0].tone === 5) return null;
  if (syl.length === 2 && syl[0].tone === 5) return null;
  if (syl.length > 2) return null;
  const bases = syl.map((s) => s.base);
  const tones = syl.map((s) => s.tone);
  return {
    word: w.id,
    hanzi: w.hanzi,
    pinyin: syl.map(markSyllable).join(''),
    bases,
    tones,
    pattern: tones.join('-'),
    sandhi: sandhiOf(w.hanzi, bases, tones),
    sources,
    gloss: w.short ?? w.gloss[0] ?? '',
  };
}

/** A Tone Perfect recording of one syllable in one tone by one speaker. */
export function tpUrl(base: string, syllable: string, tone: number, speaker: string): string {
  return `${base}audio/tp/${syllable}${tone}_${speaker}.mp3`;
}

/**
 * Single tones from Tone Perfect: every Mandarin syllable in every tone, each by
 * up to six real speakers (high-variability training). A common HSK word with
 * that exact reading gives the meaning shown afterwards, when there is one.
 */
export function tonePerfectPool(vocab: VocabRow[], base: string): GymItem[] {
  const meaning = new Map<string, VocabRow>();
  for (const w of vocab) {
    if ([...w.hanzi].length !== 1) continue;
    const syl = parsePinyin(w.pinyin.replace(/\s+/g, ''), 1);
    if (!syl || syl.length !== 1) continue;
    const k = `${syl[0].base}${syl[0].tone}`;
    if (!meaning.has(k)) meaning.set(k, w);
  }
  const out: GymItem[] = [];
  for (const [syllable, tones] of Object.entries(TP)) {
    for (const [t, speakers] of Object.entries(tones)) {
      const tone = Number(t) as Tone;
      const w = meaning.get(`${syllable}${tone}`);
      out.push({
        word: `tp-${syllable}${tone}`,
        hanzi: w?.hanzi ?? '',
        pinyin: markSyllable({ base: syllable, tone }),
        bases: [syllable],
        tones: [tone],
        pattern: String(tone),
        sources: speakers.map((sp) => ({ url: tpUrl(base, syllable, tone, sp), speaker: TP_SPEAKERS[sp] ?? sp })),
        gloss: w ? `${w.hanzi} ${w.short ?? w.gloss[0] ?? ''}`.trim() : '',
      });
    }
  }
  return out;
}

/** Everything the Tone Gym asks: single tones by real speakers (Tone Perfect). */
export function buildPool(vocab: VocabRow[], base: string): GymItem[] {
  return tonePerfectPool(vocab, base);
}

/** For sessions: single tones by real speakers only. */
export function sessionPool(vocab: VocabRow[], base: string): GymItem[] {
  return tonePerfectPool(vocab, base);
}

// ---------------------------------------------------------------------------
// What you mix up: from every answer that logged tones (typed answers, tone exercises, the gym).

export interface ToneLog {
  tones?: { expected: string; given: string };
  exercise?: string;
}

export interface PatternStat {
  n: number;
  wrong: number;
}

/** 3+3 sandhi: a 2nd tone typed for the first of two 3rd tones isn't a mistake. */
const sameTone = (exp: number[], giv: number[], i: number) => giv[i] === exp[i] || (exp[i] === 3 && exp[i + 1] === 3 && giv[i] === 2);

/**
 * Accuracy per single tone ("3") and per adjacent pair ("2-3"), counting only
 * syllables where a tone was given. Long typed answers contribute every adjacent pair.
 */
export function patternStats(logs: ToneLog[]): Map<string, PatternStat> {
  const out = new Map<string, PatternStat>();
  const add = (k: string, ok: boolean) => {
    const s = out.get(k) ?? { n: 0, wrong: 0 };
    s.n++;
    if (!ok) s.wrong++;
    out.set(k, s);
  };
  for (const l of logs) {
    if (!l.tones) continue;
    const exp = l.tones.expected.split('-').map(Number);
    const giv = l.tones.given.split('-').map(Number);
    for (let i = 0; i < exp.length; i++) {
      if (!giv[i] || exp[i] < 1 || exp[i] > 5) continue;
      if (exp[i] !== 5) add(String(exp[i]), sameTone(exp, giv, i));
      if (i + 1 < exp.length && giv[i + 1] && exp[i] !== 5) add(`${exp[i]}-${exp[i + 1]}`, sameTone(exp, giv, i) && sameTone(exp, giv, i + 1));
    }
  }
  return out;
}

/** Smoothed error rate: a pattern you haven't practised counts as a 1-in-3 miss. */
export function errorRate(s: PatternStat | undefined): number {
  return ((s?.wrong ?? 0) + 1) / ((s?.n ?? 0) + 3);
}

/** The pair you miss most (with at least 3 tries), e.g. "2-3". */
export function weakestPair(stats: Map<string, PatternStat>): { pattern: string; error: number } | null {
  let best: { pattern: string; error: number } | null = null;
  for (const [k, s] of stats) {
    if (!k.includes('-') || s.n < 3) continue;
    const e = s.wrong / s.n;
    if (!best || e > best.error) best = { pattern: k, error: e };
  }
  return best && best.error > 0 ? best : null;
}

// ---------------------------------------------------------------------------
// Picking a round

export function candidates(pool: GymItem[], mode: GymMode): GymItem[] {
  switch (mode) {
    case 'single':
      return pool.filter((x) => x.tones.length === 1);
    case 'pairs':
      return pool.filter((x) => x.tones.length === 2);
    case 'sandhi':
      return pool.filter((x) => x.sandhi);
    default:
      return pool;
  }
}

/**
 * 20 items, weighted towards your weak patterns: each pick first chooses a tone
 * pattern (weight = smoothed error rate), then a word with that pattern not used yet.
 * Workouts are about 40% single tones and 60% pairs.
 */
export function pickRound(pool: GymItem[], mode: GymMode, stats: Map<string, PatternStat>, rng: () => number = Math.random, n = ROUND): GymItem[] {
  const all = candidates(pool, mode);
  const byPattern = new Map<string, GymItem[]>();
  for (const x of all) byPattern.set(x.pattern, [...(byPattern.get(x.pattern) ?? []), x]);
  const used = new Set<string>();
  const out: GymItem[] = [];
  const choose = <T,>(xs: T[], w: (x: T) => number): T => {
    const total = xs.reduce((a, x) => a + w(x), 0);
    let r = rng() * total;
    for (const x of xs) if ((r -= w(x)) <= 0) return x;
    return xs[xs.length - 1];
  };
  for (let i = 0; i < n && used.size < all.length; i++) {
    let patterns = [...byPattern.keys()].filter((p) => byPattern.get(p)!.some((x) => !used.has(x.word)));
    if (mode === 'mixed') {
      const wantSingle = rng() < 0.4;
      const narrowed = patterns.filter((p) => !p.includes('-') === wantSingle);
      if (narrowed.length) patterns = narrowed;
    }
    if (!patterns.length) break;
    // Even mix: every tone equally likely. Otherwise weighted to your mistakes.
    const p = choose(patterns, (k) => (mode === 'single' ? 1 : 0.15 + errorRate(stats.get(k))));
    const options = byPattern.get(p)!.filter((x) => !used.has(x.word));
    const item = options[Math.floor(rng() * options.length)];
    used.add(item.word);
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The confusion matrix

/** counts[expected][given] for tones 1–5 (index 0 unused). */
export function toneMatrix(logs: ToneLog[]): number[][] {
  const m = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (const l of logs) {
    if (!l.tones) continue;
    const exp = l.tones.expected.split('-').map(Number);
    const giv = l.tones.given.split('-').map(Number);
    exp.forEach((e, i) => {
      const g = giv[i];
      if (!g || e < 1 || e > 5 || g < 1 || g > 5) return;
      // 3+3 → 2+3 counts as right.
      m[e][sameTone(exp, giv, i) ? e : g]++;
    });
  }
  return m;
}

/** Most frequent pair mix-ups, e.g. 2-3 heard as 3-2. */
export function pairConfusions(logs: ToneLog[], top = 5): Array<{ expected: string; given: string; count: number }> {
  const counts = new Map<string, number>();
  for (const l of logs) {
    if (!l.tones) continue;
    const exp = l.tones.expected.split('-').map(Number);
    const giv = l.tones.given.split('-').map(Number);
    for (let i = 0; i + 1 < exp.length; i++) {
      if (!giv[i] || !giv[i + 1] || exp[i] === 5) continue;
      if (sameTone(exp, giv, i) && sameTone(exp, giv, i + 1)) continue;
      const k = `${exp[i]}-${exp[i + 1]}>${giv[i]}-${giv[i + 1]}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([k, count]) => {
      const [expected, given] = k.split('>');
      return { expected, given, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

export const TONE_WORD = ['', '1st', '2nd', '3rd', '4th', 'neutral'];
export const patternLabel = (p: string) => p.replace('-', '–').replace(/5/g, '0');
