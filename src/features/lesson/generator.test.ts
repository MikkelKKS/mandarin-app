import { describe, expect, it } from 'vitest';
import { exchanges, nodes, sentences, sounds, units, words } from '../../content';
import { seeded } from '../../lib/random';
import { generateLesson } from './generator';
import { AUDIO_ONLY, CATEGORY } from './types';

function inputFor(nodeId: string, seed: number, quiet = false) {
  const n = nodes.get(nodeId)!;
  return {
    words: n.words.map((id) => words.get(id)!),
    sentences: n.sentences.map((id) => sentences.get(id)!),
    exchanges: n.exchanges.map((id) => exchanges.get(id)!),
    poolWords: [...words.values()],
    poolSentences: [...sentences.values()],
    allSentences: sentences,
    minimalPairs: sounds.minimalPairs,
    introduce: [],
    length: 12,
    quiet,
    voice: () => 'f' as const,
    rnd: seeded(seed),
  };
}

const lessonNodes = units.flatMap((u) => u.nodes.filter((n) => n.kind === 'lesson').map((n) => n.id));

describe('generateLesson', () => {
  it('fills every lesson node with ~12 exercises that reference real content', () => {
    for (const id of lessonNodes) {
      for (let seed = 1; seed <= 15; seed++) {
        const ex = generateLesson(inputFor(id, seed));
        expect(ex.length, id).toBeGreaterThanOrEqual(10);
        for (const e of ex) {
          if ('itemId' in e) expect(words.has(e.itemId) || sentences.has(e.itemId), `${id} ${e.kind}`).toBe(true);
          if ('sentenceId' in e) expect(sentences.has(e.sentenceId)).toBe(true);
          if ('exchangeId' in e) expect(exchanges.has(e.exchangeId)).toBe(true);
          if ('options' in e && 'answer' in e) {
            expect(new Set(e.options).size).toBe(e.options.length);
            expect(e.answer).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('roughly follows the listening-first mix', () => {
    const counts = { listening: 0, pinyin: 0, recognition: 0, other: 0 };
    let total = 0;
    for (const id of lessonNodes) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const e of generateLesson(inputFor(id, seed))) {
          counts[CATEGORY[e.kind]]++;
          total++;
        }
      }
    }
    expect(counts.listening / total).toBeGreaterThan(0.4);
    expect(counts.pinyin / total).toBeGreaterThan(0.15);
    expect(counts.recognition / total).toBeGreaterThan(0.08);
  });

  it('never uses audio-only exercises in quiet mode', () => {
    for (const id of lessonNodes) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const e of generateLesson(inputFor(id, seed, true))) expect(AUDIO_ONLY.has(e.kind), e.kind).toBe(false);
      }
    }
  });

  it('adds intro cards for new words first', () => {
    const inp = { ...inputFor('n01-names', 3), introduce: ['w-jiao', 'w-mingzi'] };
    const ex = generateLesson(inp);
    expect(ex.slice(0, 2).map((e) => e.kind)).toEqual(['intro', 'intro']);
  });
});
