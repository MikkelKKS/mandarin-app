import { describe, expect, it } from 'vitest';
import type { SentenceRow, VocabData, VocabRow } from '../../lib/vocabData';
import type { GymItem } from '../tonegym/model';
import { cardOf, itemCount, listeningItems, newWordItems, planSession, QUICK, reviewItem } from './plan';

const word = (i: number, extra: Partial<VocabRow> = {}): VocabRow => ({
  id: `w${i}`,
  hanzi: String.fromCodePoint(0x4e00 + i),
  pinyin: 'mā',
  gloss: [`gloss ${i}`],
  level: 1,
  order: i + 1,
  examples: [`s${i}`],
  azure: true,
  ...extra,
});
const sentence = (i: number, words: string[]): SentenceRow => ({ id: `s${i}`, hanzi: '妈妈好。', pinyin: 'Māma hǎo.', english: ['Hi mum.'], words, azure: true, course: false });
const words = Array.from({ length: 40 }, (_, i) => word(i));
const data: VocabData = {
  words,
  byId: new Map(words.map((w) => [w.id, w])),
  sentences: new Map(words.map((w, i) => [`s${i}`, sentence(i, [w.id, 'w0'])])),
};
const tone = (i: number) => ({ word: `t${i}` }) as GymItem;
const rng = () => 0.42;

describe('session items', () => {
  it('turns due cards into the right exercise', () => {
    expect(reviewItem('w1#lm', data)).toEqual({ kind: 'listen-meaning', word: 'w1' });
    expect(reviewItem('w1#lp', data)).toEqual({ kind: 'dictation', word: 'w1' });
    expect(reviewItem('w1#mp', data)).toEqual({ kind: 'meaning-pinyin', word: 'w1' });
    expect(reviewItem('w1#sp', data)).toBeNull();
    expect(reviewItem('s3', data)).toEqual({ kind: 'sentence-dictation', sentence: 's3', card: 's3' });
    expect(reviewItem('nope#lm', data)).toBeNull();
    expect(cardOf({ kind: 'choose-meaning', word: 'w1', options: [] })).toBe('w1#lm');
  });
  it('skips listening exercises for words without any recording', () => {
    const silent = { ...data, byId: new Map([['w1', word(1, { azure: false })]]) };
    expect(reviewItem('w1#lp', silent)).toBeNull();
    expect(reviewItem('w1#mp', silent)).toEqual({ kind: 'meaning-pinyin', word: 'w1' });
  });
  it('introduces new words: meet, choose once, type twice, hear in a sentence', () => {
    const items = newWordItems(['w1', 'w2'], data, rng);
    expect(items.slice(0, 4).map((x) => x.kind)).toEqual(['intro', 'choose-meaning', 'intro', 'choose-meaning']);
    const choose = items[1] as { options: string[] };
    expect(choose.options).toHaveLength(4);
    expect(choose.options).toContain('w1');
    expect(items.filter((x) => x.kind === 'dictation' || x.kind === 'meaning-pinyin')).toHaveLength(4);
    expect(items.filter((x) => x.kind === 'sentence-meaning')).toHaveLength(2);
  });
  it('listens only to sentences of words you have started', () => {
    const items = listeningItems(data, new Set(['w0', 'w5']), 8, rng);
    expect(items.map((x) => (x as { sentence: string }).sentence).sort()).toEqual(['s0', 's5']);
  });
});

describe('planning sessions', () => {
  const base = { data, started: new Set(['w0']), mic: false, now: 1, rng, tones: Array.from({ length: 20 }, (_, i) => tone(i)) };
  it('quick: reviews with tone items mixed in', () => {
    const reviews = Array.from({ length: 30 }, (_, i) => `w${i}#mp`);
    const plan = planSession({ ...base, mode: 'quick', reviews, newWords: ['w30'] });
    const items = plan.blocks[0].items;
    expect(items.filter((x) => x.kind === 'meaning-pinyin')).toHaveLength(QUICK.reviews);
    expect(items[QUICK.toneEvery].kind).toBe('tone');
    // Plenty due: no new words.
    expect(plan.blocks.some((b) => b.id === 'new')).toBe(false);
  });
  it('quick: a few new words when little is due', () => {
    const plan = planSession({ ...base, mode: 'quick', reviews: ['w1#mp'], newWords: ['w10', 'w11', 'w12', 'w13'] });
    expect(plan.blocks.map((b) => b.id)).toEqual(['reviews', 'new', 'tones']);
    expect(plan.blocks[1].items.filter((x) => x.kind === 'intro')).toHaveLength(QUICK.newWhenFew);
  });
  it('deep: reviews, new words, listening, Tone Gym', () => {
    const plan = planSession({ ...base, mode: 'deep', reviews: ['w1#lm', 'w2#lp'], newWords: ['w10', 'w11'] });
    expect(plan.blocks.map((b) => b.id)).toEqual(['reviews', 'new', 'listening', 'tones']);
    expect(plan.blocks[3].items).toHaveLength(20);
    expect(itemCount(plan)).toBeGreaterThan(25);
  });
  it('works with nothing due and nothing new', () => {
    const plan = planSession({ ...base, mode: 'quick', reviews: [], newWords: [] });
    expect(plan.blocks.map((b) => b.id)).toEqual(['tones']);
  });
});
