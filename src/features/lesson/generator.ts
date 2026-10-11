/**
 * Builds lessons from a set of words, sentences and exchanges.
 * Target mix (CLAUDE.md §5): ~50% listening, ~25% pinyin, ~15% recognition, ~10% other.
 */
import type { Exchange, Sentence, Word } from '../../content/schema';
import type { Voice } from '../../content/audioPaths';
import { alignToHanzi, parsePinyin, hanziOnly } from '../../lib/pinyin';
import { shuffle, pick, sample } from '../../lib/random';
import { AUDIO_ONLY, type Exercise, type ExerciseKind } from './types';

export interface SoundPair {
  a: string;
  b: string;
  hint?: string;
}

export interface GenInput {
  words: Word[]; // focus words
  sentences: Sentence[]; // focus sentences
  exchanges: Exchange[];
  /** Everything unlocked so far, for distractors. */
  poolWords: Word[];
  poolSentences: Sentence[];
  allSentences: Map<string, Sentence>;
  minimalPairs: SoundPair[];
  introduce: string[]; // word ids to show intro cards for
  length: number;
  quiet: boolean; // "can't listen now"
  /** Add optional repeat-after-me exercises. */
  speaking?: boolean;
  /** Add extra tone exercises. */
  toneFocus?: boolean;
  voice: () => Voice;
  rnd?: () => number;
}

type Target = { type: 'word'; w: Word } | { type: 'sentence'; s: Sentence } | { type: 'exchange'; x: Exchange };

let counter = 0;
const key = (k: string) => `${k}-${++counter}`;

const syllableCount = (hz: string) => [...hanziOnly(hz)].length;
const tonelessCache = new Map<string, string>();
const toneless = (p: string) => {
  let t = tonelessCache.get(p);
  if (t === undefined) {
    t = (parsePinyin(p) ?? []).map((s) => s.base).join('');
    tonelessCache.set(p, t);
  }
  return t;
};

/** Weighted plan of categories for a lesson of n exercises. */
export function categoryPlan(n: number, rnd = Math.random): Array<'listening' | 'pinyin' | 'recognition' | 'other'> {
  const listening = Math.round(n * 0.5);
  const pinyin = Math.round(n * 0.25);
  const recognition = Math.max(1, Math.round(n * 0.15));
  const other = Math.max(0, n - listening - pinyin - recognition);
  const plan = [
    ...Array(listening).fill('listening'),
    ...Array(pinyin).fill('pinyin'),
    ...Array(recognition).fill('recognition'),
    ...Array(other).fill('other'),
  ];
  return shuffle(plan, rnd);
}

const BY_CATEGORY: Record<string, ExerciseKind[]> = {
  listening: ['listen-meaning', 'listen-sentence', 'listen-tiles', 'dictation', 'what-would-you-say', 'tone-id'],
  pinyin: ['en-to-pinyin', 'fill-gap', 'build-sentence', 'reply-type'],
  recognition: ['pick-character', 'read-sentence', 'match-pairs'],
  other: ['minimal-pair', 'tone-id', 'match-pairs'],
  tones: ['tone-id', 'tone-id', 'minimal-pair', 'dictation'],
};

/** When the user can't listen, swap audio-only kinds for reading ones. */
const QUIET_SWAP: ExerciseKind[] = ['read-sentence', 'pick-character', 'build-sentence', 'en-to-pinyin', 'what-would-you-say'];

export function generateLesson(input: GenInput): Exercise[] {
  const rnd = input.rnd ?? Math.random;
  const out: Exercise[] = [];

  for (const id of input.introduce) out.push({ kind: 'intro', key: key('intro'), wordId: id });

  const plan: Array<string> = categoryPlan(input.length, rnd);
  if (input.toneFocus && !input.quiet) for (let i = 0; i < 3; i++) plan.splice(Math.floor(rnd() * (plan.length + 1)), 0, 'tones');
  // Rotate through targets so every focus item gets attention.
  const targets: Target[] = shuffle(
    [
      ...input.words.map((w) => ({ type: 'word', w }) as Target),
      ...input.sentences.map((s) => ({ type: 'sentence', s }) as Target),
      ...input.exchanges.map((x) => ({ type: 'exchange', x }) as Target),
    ],
    rnd,
  );
  let ti = 0;
  const used = new Set<string>();

  for (const cat of plan) {
    let kinds = shuffle(BY_CATEGORY[cat], rnd);
    if (input.quiet) kinds = shuffle([...kinds.filter((k) => !AUDIO_ONLY.has(k)), ...QUIET_SWAP], rnd);
    let made: Exercise | null = null;
    // Try each kind against the next few targets until something fits.
    outer: for (const kind of kinds) {
      for (let attempt = 0; attempt < Math.max(1, targets.length); attempt++) {
        const t = targets.length ? targets[(ti + attempt) % targets.length] : null;
        made = make(kind, t, input, rnd);
        if (made) {
          const sig = signature(made);
          if (used.has(sig)) {
            made = null;
            continue;
          }
          used.add(sig);
          ti = (ti + attempt + 1) % Math.max(1, targets.length);
          break outer;
        }
      }
    }
    if (made) out.push(made);
  }
  if (input.speaking) {
    const candidates = [...input.sentences, ...input.words].filter((x) => syllableCount(x.hanzi) <= 8);
    for (const item of sample(candidates, Math.min(2, candidates.length), rnd)) {
      const at = input.introduce.length + 1 + Math.floor(rnd() * Math.max(1, out.length - input.introduce.length - 1));
      out.splice(Math.min(at, out.length), 0, { kind: 'repeat', key: key('repeat'), itemId: item.id, voice: input.voice() });
    }
  }
  return out;
}

/** Avoid asking the exact same thing twice in one lesson. */
function signature(e: Exercise): string {
  switch (e.kind) {
    case 'match-pairs':
      return e.kind;
    case 'minimal-pair':
      return `${e.kind}:${e.a}:${e.b}`;
    default: {
      const id = 'itemId' in e ? e.itemId : 'sentenceId' in e ? e.sentenceId : 'exchangeId' in e ? e.exchangeId : 'wordId' in e ? e.wordId : '';
      return `${e.kind}:${id}`;
    }
  }
}

function englishOf(t: Word | Sentence): string {
  return 'words' in t ? t.english : t.english[0];
}

function distinctOptions(answer: string, candidates: string[], n: number, rnd: () => number): { options: string[]; answer: number } | null {
  const pool = [...new Set(candidates.filter((c) => c.toLowerCase() !== answer.toLowerCase()))];
  if (pool.length < n) return null;
  const options = shuffle([answer, ...sample(pool, n, rnd)], rnd);
  return { options, answer: options.indexOf(answer) };
}

function make(kind: ExerciseKind, t: Target | null, inp: GenInput, rnd: () => number): Exercise | null {
  const voice = () => inp.voice();
  const word = t?.type === 'word' ? t.w : null;
  const sentence = t?.type === 'sentence' ? t.s : null;
  const exchange = t?.type === 'exchange' ? t.x : null;
  const item = word ?? sentence;

  switch (kind) {
    case 'listen-meaning': {
      if (!item) return null;
      const homophone = toneless(item.pinyin);
      const pool = (word ? inp.poolWords : inp.poolSentences).filter((o) => o.id !== item.id && toneless(o.pinyin) !== homophone);
      const opts = distinctOptions(englishOf(item), pool.map(englishOf), 3, rnd);
      if (!opts) return null;
      return { kind, key: key(kind), itemId: item.id, voice: voice(), ...opts };
    }
    case 'listen-sentence': {
      if (!sentence) return null;
      const pool = inp.poolSentences.filter((o) => o.id !== sentence.id && hanziOnly(o.hanzi) !== hanziOnly(sentence.hanzi) && toneless(o.pinyin) !== toneless(sentence.pinyin));
      if (pool.length < 3) return null;
      // Prefer similar-length sentences to make it a real listening test.
      const close = [...pool].sort((a, b) => Math.abs(a.words.length - sentence.words.length) - Math.abs(b.words.length - sentence.words.length));
      const options = shuffle([sentence.id, ...sample(close.slice(0, 6), 3, rnd).map((s) => s.id)], rnd);
      return { kind, key: key(kind), itemId: sentence.id, options, answer: options.indexOf(sentence.id), voice: voice() };
    }
    case 'listen-tiles':
    case 'build-sentence': {
      if (!sentence || sentence.words.length < 3 || sentence.words.length > 9) return null;
      const inSentence = new Set(sentence.words);
      const extra = sample(
        inp.poolWords.filter((w) => !inSentence.has(w.id) && w.hanzi.length <= 3),
        2,
        rnd,
      ).map((w) => w.id);
      const tiles = shuffle([...sentence.words, ...extra], rnd);
      return kind === 'listen-tiles'
        ? { kind, key: key(kind), sentenceId: sentence.id, tiles, voice: voice() }
        : { kind, key: key(kind), sentenceId: sentence.id, tiles };
    }
    case 'dictation': {
      if (!item || syllableCount(item.hanzi) > 6) return null;
      return { kind, key: key(kind), itemId: item.id, voice: voice() };
    }
    case 'tone-id': {
      if (!word) return null;
      const syl = alignToHanzi(word.hanzi, word.pinyin)?.syls;
      if (!syl || syl.length > 2 || syl.every((s) => s.tone === 5)) return null;
      return { kind, key: key(kind), itemId: word.id, voice: voice() };
    }
    case 'minimal-pair': {
      if (!inp.minimalPairs.length) return null;
      const p = pick(inp.minimalPairs, rnd);
      return { kind, key: key(kind), a: p.a, b: p.b, hint: p.hint, answer: rnd() < 0.5 ? 0 : 1, voice: voice() };
    }
    case 'what-would-you-say': {
      if (!exchange) return null;
      const options = shuffle([exchange.reply, ...sample(exchange.wrong, 2, rnd)], rnd);
      return { kind, key: key(kind), exchangeId: exchange.id, options, answer: options.indexOf(exchange.reply), voice: voice() };
    }
    case 'reply-type': {
      if (!exchange) return null;
      const reply = inp.allSentences.get(exchange.reply);
      if (!reply || syllableCount(reply.hanzi) > 8) return null;
      return { kind, key: key(kind), exchangeId: exchange.id, voice: voice() };
    }
    case 'en-to-pinyin': {
      if (!item || syllableCount(item.hanzi) > 8) return null;
      return { kind, key: key(kind), itemId: item.id };
    }
    case 'fill-gap': {
      if (!sentence || sentence.words.length < 3) return null;
      const focus = new Set(inp.words.map((w) => w.id));
      const idx = sentence.words.map((w, i) => ({ w, i }));
      const preferred = idx.filter(({ w }) => focus.has(w));
      const choice = pick(preferred.length ? preferred : idx, rnd);
      return { kind, key: key(kind), sentenceId: sentence.id, gap: choice.i };
    }
    case 'match-pairs': {
      const base = inp.words.length >= 4 ? inp.words : [...inp.words, ...inp.poolWords];
      const uniq = new Map<string, Word>();
      for (const w of shuffle(base, rnd)) {
        // no duplicate hanzi, pinyin or meanings within one grid
        if ([...uniq.values()].some((u) => u.hanzi === w.hanzi || u.pinyin === w.pinyin || u.english[0] === w.english[0])) continue;
        uniq.set(w.id, w);
        if (uniq.size === 5) break;
      }
      if (uniq.size < 4) return null;
      return { kind, key: key(kind), wordIds: [...uniq.keys()], mode: rnd() < 0.5 ? 'pinyin' : 'meaning' };
    }
    case 'pick-character': {
      if (!word) return null;
      const pool = inp.poolWords.filter((w) => w.id !== word.id && w.hanzi !== word.hanzi && w.english[0] !== word.english[0]);
      if (pool.length < 3) return null;
      const options = shuffle([word.id, ...sample(pool, 3, rnd).map((w) => w.id)], rnd);
      return { kind, key: key(kind), wordId: word.id, options, answer: options.indexOf(word.id) };
    }
    case 'read-sentence': {
      if (!sentence) return null;
      const opts = distinctOptions(sentence.english, inp.poolSentences.filter((s) => s.id !== sentence.id).map((s) => s.english), 3, rnd);
      if (!opts) return null;
      return { kind, key: key(kind), sentenceId: sentence.id, ...opts };
    }
    default:
      return null;
  }
}
