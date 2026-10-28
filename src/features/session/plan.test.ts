import { describe, expect, it } from 'vitest';
import type { SentenceRow, VocabData, VocabRow } from '../../lib/vocabData';
import type { GymItem } from '../tonegym/model';
import { cardOf, itemCount, listeningItems, newWordItems, planSession, QUICK, reviewItem } from './plan';

const word = (i: number, extra: Partial<VocabRow> = {}): VocabRow => ({
  id: `w${i}`,
  hanzi: String.fromCodePoint(0x4e00 + i),
  pinyin: `mā${'a'.repeat(i)}`,
  gloss: [`g${'x'.repeat(i + 1)}`],
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
    expect(items.slice(0, 4).map((x) => x.kind)).toEqual(['intro', 'intro', 'choose-meaning', 'choose-meaning']);
    const choose = items[2] as { options: string[] };
    expect(choose.options).toHaveLength(4);
    expect(choose.options).toContain('w1');
    expect(items.filter((x) => x.kind === 'dictation' || x.kind === 'meaning-pinyin')).toHaveLength(4);
    expect(items.filter((x) => x.kind === 'sentence-meaning')).toHaveLength(2);
  });
  it("asks a word's meaning only after the next three words' intros", () => {
    const items = newWordItems(['w1', 'w2', 'w3', 'w4', 'w5'], data, rng);
    const at = (kind: string, w: string) => items.findIndex((x) => x.kind === kind && (x as { word?: string }).word === w);
    expect(at('choose-meaning', 'w1')).toBeGreaterThan(at('intro', 'w4'));
    expect(at('choose-meaning', 'w2')).toBeGreaterThan(at('intro', 'w5'));
    expect(items.filter((x) => x.kind === 'choose-meaning')).toHaveLength(5);
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
    expect(plan.blocks[3].items).toHaveLength(12);
    expect(itemCount(plan)).toBeGreaterThan(25);
  });
  it('deep with the microphone on: a speaking block of due and new speaking cards', () => {
    const plan = planSession({ ...base, mic: true, mode: 'deep', reviews: ['w1#sp', 'w2#lm'], newWords: [], speakNew: ['w5', 'w6'] });
    expect(plan.blocks.map((b) => b.id)).toEqual(['reviews', 'listening', 'speaking', 'tones']);
    expect(plan.blocks[0].items).toEqual([{ kind: 'listen-meaning', word: 'w2' }]);
    expect(plan.blocks[2].items).toEqual([
      { kind: 'speak', word: 'w1' },
      { kind: 'speak', word: 'w5' },
      { kind: 'speak', word: 'w6' },
    ]);
    // Microphone off: speaking cards are skipped, not shown.
    const off = planSession({ ...base, mic: false, mode: 'deep', reviews: ['w1#sp', 'w2#lm'], newWords: [], speakNew: ['w5'] });
    expect(off.blocks.some((b) => b.id === 'speaking')).toBe(false);
    expect(off.blocks[0].items).toHaveLength(1);
  });
  it('works with nothing due and nothing new', () => {
    const plan = planSession({ ...base, mode: 'quick', reviews: [], newWords: [] });
    expect(plan.blocks.map((b) => b.id)).toEqual(['tones']);
  });
});

describe('wrong options for "what does it mean?"', async () => {
  const { distractors } = await import('./plan');
  const row = (id: string, pinyin: string, gloss: string[], order: number) => ({ id, hanzi: id, pinyin, gloss, level: 1, order, examples: [], azure: true });
  const de = row('de', 'dé', ['to obtain', 'to get'], 10);
  const words = [
    de,
    row('huode', 'huòdé', ['to acquire; to get; to obtain'], 11),
    row('shi', 'dé', ['virtue'], 12), // a homophone
    row('ma', 'mǎ', ['horse'], 13),
    row('mai', 'mǎi', ['to buy'], 14),
    row('chi', 'chī', ['to eat'], 15),
    row('he', 'hē', ['to drink'], 16),
  ];
  it('never offers a near-synonym or a homophone', () => {
    for (let seed = 1; seed < 20; seed++) {
      let x = seed;
      const ids = distractors(de, words, () => ((x = (x * 9301 + 49297) % 233280) / 233280));
      expect(ids).toHaveLength(3);
      expect(ids).not.toContain('huode');
      expect(ids).not.toContain('shi');
    }
  });
});

describe('what Home says a session holds', async () => {
  const { sessionPreview } = await import('./plan');
  it('a quick session: at most 24 reviews, new words only when little is due', () => {
    expect(sessionPreview('quick', 30, 10, true)).toEqual({ reviews: 24, newWords: 0, tones: 6 });
    expect(sessionPreview('quick', 2, 10, false)).toEqual({ reviews: 2, newWords: 3, tones: 0 });
  });
  it('a deep session: up to 10 new words', () => {
    expect(sessionPreview('deep', 30, 10, true)).toEqual({ reviews: 30, newWords: 10, tones: 12 });
  });
});

describe('say it in pinyin (deep sessions)', async () => {
  const { productionItems } = await import('./plan');
  it('uses only sentences of words you have started, newest words first', () => {
    const started = new Set(['w0', 'w1', 'w2', 'w3', 'w7']);
    const items = productionItems(data, started, ['w7', 'w3'], 3, rng);
    const ids = items.map((x) => (x as { sentence: string }).sentence);
    expect(items.every((x) => x.kind === 'sentence-pinyin')).toBe(true);
    expect(ids[0]).toBe('s7'); // the sentence with the newest word
    expect(ids[1]).toBe('s3');
    expect(ids.every((id) => data.sentences.get(id)!.words.every((w) => started.has(w)))).toBe(true);
  });
  it('skips sentences already heard in the listening block', () => {
    const items = productionItems(data, new Set(['w0', 'w7']), ['w7'], 3, rng, new Set(['s7']));
    expect(items.map((x) => (x as { sentence: string }).sentence)).not.toContain('s7');
  });
});

describe('homophones and particles are heard in a sentence', async () => {
  const { reviewItem, newWordItems: items, cardOf: card } = await import('./plan');
  const mk = (id: string, hanzi: string, pinyin: string, examples: string[] = [], extra: Partial<VocabRow> = {}): VocabRow => ({ id, hanzi, pinyin, gloss: [id], level: 1, order: 1, examples, azure: true, ...extra });
  const shi = mk('shi', '是', 'shì', ['x1']);
  const shi2 = mk('shi2', '事', 'shì');
  const le = mk('le', '了', 'le');
  const ma = mk('ma', '马', 'mǎ');
  const x1: SentenceRow = { id: 'x1', hanzi: '我是学生。', pinyin: 'Wǒ shì xuésheng.', english: ["I'm a student."], words: [], azure: true, course: false };
  const d: VocabData = { words: [shi, shi2, le, ma], byId: new Map([shi, shi2, le, ma].map((w) => [w.id, w])), sentences: new Map([['x1', x1]]) };
  it('a homophone is listened to and dictated in its example sentence', () => {
    expect(reviewItem('shi#lm', d)).toEqual({ kind: 'listen-meaning', word: 'shi', ctx: 'x1' });
    expect(reviewItem('shi#lp', d)).toEqual({ kind: 'dictation', word: 'shi', ctx: 'x1' });
    expect(reviewItem('ma#lp', d)).toEqual({ kind: 'dictation', word: 'ma' }); // not a homophone
  });
  it('a particle with no sentence is never dictated on its own', () => {
    const it2 = reviewItem('le#lp', d)!;
    expect(it2).toEqual({ kind: 'meaning-pinyin', word: 'le', card: 'le#lp' });
    expect(card(it2)).toBe('le#lp');
    expect(items(['le'], d, () => 0.3).some((x) => x.kind === 'dictation')).toBe(false);
  });
});
