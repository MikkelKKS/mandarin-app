import { describe, expect, it } from 'vitest';
import type { ReviewItemRow } from '../db/db';
import { buildReadIndex, buildReadQueue, lookalikesOf, newReadToday, parseReadId, readableShare, readCardId, readingByLevel, readingStates, type HanziData } from './reading';
import { cardId, newCard, parseCardId, wordState } from './review';
import { wordsByLevel } from './statsData';
import type { VocabRow } from './vocabData';

const word = (id: string, hanzi: string, pinyin: string, order: number, level = 1, gloss = id): VocabRow => ({ id, hanzi, pinyin, gloss: [gloss], level, order, examples: [], azure: true });
const words: VocabRow[] = [
  word('hao', '好', 'hǎo', 1, 1, 'good'),
  word('xuesheng', '学生', 'xué sheng', 2, 1, 'student'),
  word('xue', '学', 'xué', 3, 1, 'to study'),
  word('nihao', '你好', 'nǐ hǎo', 4, 1, 'hello'),
  word('hao4', '好', 'hào', 50, 3, 'to be fond of'),
  word('dahai', '大海', 'dà hǎi', 60, 2, 'sea'),
];
const hanzi: HanziData = {
  好: { py: 'hǎo', def: 'good', lvl: 1, alt: ['hào'] },
  学: { py: 'xué', def: 'learning', lvl: 1 },
  生: { py: 'shēng', def: 'life; birth', lvl: 1 },
  你: { py: 'nǐ', def: 'you', lvl: 1 },
  大: { py: 'dà', def: 'big', lvl: 1 },
  海: { py: 'hǎi', def: 'sea', lvl: 2 },
};
const index = buildReadIndex(words, hanzi, (w) => w.gloss[0]);

/** A card in long-term review. */
const inReview = (id: string, days = 30, now = 0): ReviewItemRow => ({ ...newCard(id, now), state: 2, scheduledDays: days, reps: 3, due: now + days * 864e5, lastReview: now });

describe('reading items', () => {
  it('a character that is a word shares its cards with the most common such word', () => {
    expect(index.itemOfWord.get('hao')).toBe('hao');
    expect(index.itemOfWord.get('hao4')).toBe('hao'); // 好 hào is read as the same character
    expect(index.items.get('hao')).toMatchObject({ kind: 'char', hanzi: '好', pinyin: 'hǎo', alt: ['hào'] });
    expect(index.itemOfChar.get('学')).toBe('xue');
  });
  it('characters that are not words get their own item, with the common reading and meaning', () => {
    expect(index.items.get('c-生')).toMatchObject({ kind: 'char', pinyin: 'shēng', meaning: 'life; birth' });
  });
  it('words list their characters', () => {
    expect(index.items.get('xuesheng')).toMatchObject({ kind: 'word', chars: ['xue', 'c-生'] });
  });
  it('card ids', () => {
    expect(readCardId('xuesheng', 'rp')).toBe('xuesheng#rp');
    expect(parseReadId('c-生#rm')).toEqual({ item: 'c-生', facet: 'rm' });
    // Reading cards are not word cards: the word stage never sees them.
    expect(parseCardId('xuesheng#rp')).toBeNull();
  });
});

describe('reading queue', () => {
  const now = 100 * 864e5;
  it('only words you know by ear (listening card out of learning steps), most common first, characters on top of the limit', () => {
    const cards = [inReview(cardId('xuesheng', 'lm'), 5, now - 5 * 864e5), inReview(cardId('dahai', 'lm'), 30, now - 864e5), { ...newCard(cardId('hao', 'lm'), now), state: 1, reps: 1 }];
    const q = buildReadQueue(index, words, cards, { now, mode: 'mix', newPerDay: 10, newToday: 0 });
    expect(q.fresh).toEqual([{ item: 'xuesheng' }, { item: 'xue', via: 'xuesheng' }, { item: 'c-生', via: 'xuesheng' }, { item: 'dahai' }, { item: 'c-大', via: 'dahai' }, { item: 'c-海', via: 'dahai' }]);
  });
  it('the daily limit counts words, not the characters that come with them', () => {
    const cards = [inReview(cardId('xuesheng', 'lm')), inReview(cardId('dahai', 'lm'))];
    const q = buildReadQueue(index, words, cards, { now, mode: 'mix', newPerDay: 10, newToday: 9 });
    expect(q.fresh.map((f) => f.item)).toEqual(['xuesheng', 'xue', 'c-生']);
    expect(q.newLeft).toBe(1);
  });
  it('due cards first in the chosen direction; met-but-unasked cards are pending', () => {
    const cards = [inReview('xuesheng#rp', 2, now - 4 * 864e5), inReview('xuesheng#rm', 2, now - 3 * 864e5), newCard('xue#rm', now), newCard('xue#rp', now)];
    const q = buildReadQueue(index, words, cards, { now, mode: 'rm', newPerDay: 10, newToday: 0 });
    expect(q.due).toEqual(['xuesheng#rm']);
    expect(q.pending).toEqual(['xue#rm']);
    // xuesheng was started earlier; its missing character still comes.
    expect(q.fresh).toEqual([{ item: 'c-生', via: 'xuesheng' }]);
  });
  it('new reading words today come from intro logs without a "via"', () => {
    const at = now;
    expect(
      newReadToday(
        [
          { exercise: 'read-intro', itemId: 'xuesheng', at },
          { exercise: 'read-intro', itemId: 'xue', at, via: 'xuesheng' },
          { exercise: 'read-intro', itemId: 'dahai', at: at - 2 * 864e5 },
        ],
        now,
      ),
    ).toBe(1);
  });
});

describe('reading stage', () => {
  it('is its own: reading cards never change the word stage', () => {
    const cards = [inReview(cardId('xuesheng', 'lm')), inReview(cardId('xuesheng', 'lp')), inReview(cardId('xuesheng', 'mp')), newCard('xuesheng#rp', 0), newCard('xuesheng#rm', 0)];
    expect(wordState(cards.filter((c) => parseCardId(c.id)))).toBe('mature');
    expect(wordsByLevel(words, cards).find((l) => l.level === 1)!.counts.mature).toBe(1);
    expect(readingStates(cards).get('xuesheng')).toBe('new');
  });
  it('weakest of the two reading cards', () => {
    const st = readingStates([inReview('xue#rp', 30), inReview('xue#rm', 5), inReview('c-生#rp', 30), { ...newCard('c-生#rm', 0), state: 1, reps: 1 }]);
    expect(st.get('xue')).toBe('young');
    expect(st.get('c-生')).toBe('learning');
  });
  it('by HSK level, words and characters', () => {
    const st = readingStates([inReview('xuesheng#rp', 30), inReview('xuesheng#rm', 30)]);
    const r = readingByLevel(index, words, st);
    expect(r.words.find((l) => l.level === 1)!.counts.mature).toBe(1);
    expect(r.chars.find((l) => l.level === 1)!.total).toBe(4); // 好 学 生 你 (大 and 海 first appear at HSK 2)
  });
  it('share of a text you can read', () => {
    const st = readingStates([inReview('xue#rp', 30), inReview('xue#rm', 30)]);
    expect(readableShare('学生，学！', index, st)).toBeCloseTo(2 / 3);
  });
});

describe('look-alikes', () => {
  it('lists the other characters of its groups', () => {
    expect(lookalikesOf('大', ['大太犬', '人入八'])).toEqual(['太', '犬']);
    expect(lookalikesOf('我', ['大太犬'])).toEqual([]);
  });
});
