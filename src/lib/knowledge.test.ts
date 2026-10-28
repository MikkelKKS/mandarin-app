import legacyMap from 'virtual:vocab-legacy';
import { describe, expect, it } from 'vitest';
import type { ReviewItemRow } from '../db/db';
import { courseWordState, currentLevel, hanziKnowledge, wordStates } from './knowledge';
import { newCard } from './review';
import type { VocabRow } from './vocabData';

const now = Date.UTC(2026, 9, 28);
const card = (id: string, state: number, days = 0): ReviewItemRow => ({ ...newCard(id, now), state, reps: state ? 1 : 0, scheduledDays: days });
const [courseId, hskId] = Object.entries(legacyMap)[0];

describe('one picture of what you know', () => {
  it('a word is as far along as its weakest listening/typing card; speaking is ignored', () => {
    const s = wordStates([card('a#lm', 2, 30), card('a#lp', 2, 5), card('a#mp', 2, 40), card('a#sp', 1)]);
    expect(s.get('a')).toBe('young');
  });
  it('course words share their HSK word', () => {
    const s = wordStates([card(`${hskId}#lm`, 2, 30), card(`${hskId}#lp`, 2, 30), card(`${hskId}#mp`, 2, 30)]);
    expect(courseWordState(courseId, s)).toBe('mature');
  });
  it('characters known and being learned, and the level you are on', () => {
    const vocab: VocabRow[] = [
      { id: 'x', hanzi: '你', pinyin: 'nǐ', gloss: [], level: 1, order: 1, examples: [], azure: true },
      { id: 'y', hanzi: '好', pinyin: 'hǎo', gloss: [], level: 1, order: 2, examples: [], azure: true },
      { id: 'z', hanzi: '书', pinyin: 'shū', gloss: [], level: 2, order: 3, examples: [], azure: true },
    ];
    const s = wordStates([card('x#lm', 2, 30), card('y#lm', 1)]);
    const k = hanziKnowledge(vocab, s);
    expect([...k.known]).toEqual(['你']);
    expect([...k.learning]).toEqual(['好']);
    expect(currentLevel(vocab, s)).toBe(2);
    expect(currentLevel(vocab, new Map())).toBe(1);
  });
});
