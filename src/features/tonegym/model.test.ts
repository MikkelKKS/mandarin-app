import { describe, expect, it } from 'vitest';
import type { VocabRow } from '../../lib/vocabData';
import { buildPool, candidates, errorRate, pairConfusions, patternStats, pickRound, toItem, toneMatrix, weakestPair } from './model';

const w = (id: string, hanzi: string, pinyin: string, extra: Partial<VocabRow> = {}): VocabRow => ({
  id,
  hanzi,
  pinyin,
  gloss: ['x'],
  level: 1,
  order: 1,
  examples: [],
  azure: true,
  ...extra,
});

/** Deterministic random numbers. */
function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

describe('Tone Gym items', () => {
  it('makes items from one- and two-syllable words with recordings', () => {
    const it = toItem(w('ma1', '妈', 'mā'), '/')!;
    expect(it).toMatchObject({ bases: ['ma'], tones: [1], pattern: '1' });
    expect(it.sources).toEqual([{ url: '/audio/az/ma1.mp3', speaker: 'Xiaoxiao' }]);
    expect(toItem(w('lv', '绿', 'lǜ'), '/')!.bases).toEqual(['lv']);
    expect(toItem(w('pengyou', '朋友', 'péng you'), '/')!.pattern).toBe('2-5');
  });
  it('skips words without recordings, neutral-first words, erhua and long words', () => {
    expect(toItem(w('x', '妈', 'mā', { azure: false }), '/')).toBeNull();
    expect(toItem(w('x', '吗', 'ma'), '/')).toBeNull();
    expect(toItem(w('x', '哪儿', 'nǎr'), '/')).toBeNull();
    expect(toItem(w('x', '图书馆', 'tú shū guǎn'), '/')).toBeNull();
  });
  it('uses several speakers for course words', () => {
    const it = toItem(w('ni', '你', 'nǐ', { course: 'w-ni' }), '/')!;
    expect(it.sources.map((s) => s.speaker)).toEqual(['Xiaoxiao', 'Yunxi']);
    const old = toItem(w('ni', '你', 'nǐ', { course: 'w-ni', azure: false }), '/')!;
    expect(old.sources).toHaveLength(2);
  });
  it('explains tone changes', () => {
    expect(toItem(w('nihao', '你好', 'nǐ hǎo'), '/')!.sandhi).toEqual({ spoken: 'ní hǎo', why: expect.stringContaining('3rd tone before') });
    expect(toItem(w('bushi', '不是', 'bù shì'), '/')!.sandhi?.spoken).toBe('bú shì');
    expect(toItem(w('yiqi', '一起', 'yī qǐ'), '/')!.sandhi?.spoken).toBe('yì qǐ');
    expect(toItem(w('yiding', '一定', 'yī dìng'), '/')!.sandhi?.spoken).toBe('yí dìng');
    expect(toItem(w('buhao', '不好', 'bù hǎo'), '/')!.sandhi).toBeUndefined();
  });
});

describe('what you mix up', () => {
  const logs = [
    { tones: { expected: '2-3', given: '3-2' } },
    { tones: { expected: '2-3', given: '3-2' } },
    { tones: { expected: '2-3', given: '2-3' } },
    { tones: { expected: '3-3', given: '2-3' } }, // sandhi: right
    { tones: { expected: '1-4-2', given: '1-4-3' } }, // typed sentence
    { tones: { expected: '4', given: '0' } }, // no tone given: ignored
  ];
  it('counts single tones and adjacent pairs, forgiving 3+3 sandhi', () => {
    const s = patternStats(logs);
    expect(s.get('2-3')).toEqual({ n: 3, wrong: 2 });
    expect(s.get('3-3')).toEqual({ n: 1, wrong: 0 });
    expect(s.get('4-2')).toEqual({ n: 1, wrong: 1 });
    expect(s.get('1-4')).toEqual({ n: 1, wrong: 0 });
    expect(s.get('4')).toEqual({ n: 1, wrong: 0 });
  });
  it('finds the weakest pair', () => {
    expect(weakestPair(patternStats(logs))).toEqual({ pattern: '2-3', error: 2 / 3 });
    expect(weakestPair(new Map())).toBeNull();
  });
  it('builds a confusion matrix', () => {
    const m = toneMatrix(logs);
    expect(m[2][3]).toBe(3); // twice in 2-3, once at the end of the typed sentence
    expect(m[3][2]).toBe(2);
    expect(m[3][3]).toBe(3); // once in 2-3, and both syllables of the 3+3 pair (sandhi forgiven)
    expect(m[2][2]).toBe(1);
  });
  it('lists pair mix-ups', () => {
    expect(pairConfusions(logs)[0]).toEqual({ expected: '2-3', given: '3-2', count: 2 });
  });
});

describe('picking a round', () => {
  const vocab: VocabRow[] = [];
  const syl = ['ma', 'ba', 'da', 'ta', 'na', 'la', 'ga', 'ka'];
  const marks: Record<number, string> = { 1: 'ā', 2: 'á', 3: 'ǎ', 4: 'à' };
  let k = 0;
  for (const s of syl) for (const t of [1, 2, 3, 4]) vocab.push(w(`${s}${t}`, String.fromCodePoint(0x4e00 + k++), s[0] + marks[t]));
  for (let a = 1; a <= 4; a++)
    for (let b = 1; b <= 4; b++)
      for (const s of syl.slice(0, 3)) vocab.push(w(`${s}${a}${b}`, String.fromCodePoint(0x4e00 + k++) + String.fromCodePoint(0x4e00 + k++), `${s[0] + marks[a]} ${s[0] + marks[b]}`));
  const pool = buildPool(vocab, '/');

  it('makes 20 different items of the right kind', () => {
    const r = pickRound(pool, 'single', new Map(), rng());
    expect(r).toHaveLength(20);
    expect(new Set(r.map((x) => x.word)).size).toBe(20);
    expect(r.every((x) => x.tones.length === 1)).toBe(true);
    expect(pickRound(pool, 'pairs', new Map(), rng()).every((x) => x.tones.length === 2)).toBe(true);
    expect(candidates(pool, 'sandhi').every((x) => x.sandhi)).toBe(true);
  });
  it('drills weak patterns more often', () => {
    const weak = new Map([['2-3', { n: 20, wrong: 16 }]]);
    for (const [p, n] of [['1-1', 0], ['1-2', 0]] as const) weak.set(p, { n: 20, wrong: n });
    let weakCount = 0;
    let evenCount = 0;
    for (let seed = 1; seed <= 30; seed++) {
      weakCount += pickRound(pool, 'pairs', weak, rng(seed)).filter((x) => x.pattern === '2-3').length;
      evenCount += pickRound(pool, 'pairs', new Map(), rng(seed)).filter((x) => x.pattern === '2-3').length;
    }
    expect(weakCount).toBeGreaterThan(evenCount * 1.5);
  });
  it('rates unpractised patterns as a 1-in-3 miss', () => {
    expect(errorRate(undefined)).toBeCloseTo(1 / 3);
    expect(errorRate({ n: 97, wrong: 0 })).toBeLessThan(0.02);
  });
});
