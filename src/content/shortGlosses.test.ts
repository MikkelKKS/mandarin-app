import { describe, expect, it } from 'vitest';
import short from '../../content/data/short-glosses.json';
import words from '../../content/data/words.json';
import { meaningOf } from '../lib/vocabData';

const glosses = short.glosses as Record<string, string>;

describe('short learner glosses', () => {
  it('cover every HSK 1–4 word', () => {
    const missing = (words as { id: string; level: number }[]).filter((w) => w.level <= 4 && !glosses[w.id]).map((w) => w.id);
    expect(missing).toEqual([]);
  });

  it('are short, everyday English with no stray spaces', () => {
    const bad = Object.entries(glosses).filter(([, g]) => g.length > 40 || g !== g.trim() || /\s[,;.:)]/.test(g) || /\s{2}/.test(g));
    expect(bad).toEqual([]);
  });

  it('only name words that exist', () => {
    const ids = new Set((words as { id: string }[]).map((w) => w.id));
    expect(Object.keys(glosses).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('meaningOf prefers the short gloss and falls back to the dictionary', () => {
    expect(meaningOf({ gloss: ['to eat; to have a meal'], short: 'to eat' })).toBe('to eat');
    expect(meaningOf({ gloss: ['bread'] })).toBe('bread');
  });
});
