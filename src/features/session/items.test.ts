import { describe, expect, it } from 'vitest';
import raw from '../../../content/data/words.json';
import type { VocabRow } from '../../lib/vocabData';
import { posLabel, sameMeaning } from './items';

const words = ((Array.isArray(raw) ? raw : (raw as { words: unknown[] }).words) as Array<VocabRow & { numeric: string }>).map((w) => ({ ...w, examples: [], azure: true }));
const byHanzi = (h: string, numeric: string) => words.find((w) => w.hanzi === h && w.numeric.replace(/\s/g, '') === numeric)!;

describe('typing pinyin from English', () => {
  it('knows which other words the shown meaning fits ("can": néng, huì, kěyǐ)', () => {
    const ids = sameMeaning(byHanzi('能', 'neng2'), words).map((w) => w.hanzi);
    expect(ids).toEqual(expect.arrayContaining(['会', '可以']));
  });
  it('labels the part of speech in plain words', () => {
    expect(posLabel(['verb'])).toBe('verb');
    expect(posLabel(['pr'])).toBe('pronoun');
    expect(posLabel(['name'])).toBeNull();
  });
});
