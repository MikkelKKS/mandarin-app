import { describe, expect, it } from 'vitest';
import { glossTerms, samePinyin, sharesMeaning } from './gloss';

describe('comparing meanings', () => {
  it('splits glosses into plain terms', () => {
    expect([...glossTerms(['to obtain', 'to get', 'to catch (a disease)'])]).toEqual(['obtain', 'get', 'catch']);
  });
  it('spots near-synonyms', () => {
    expect(sharesMeaning(['to obtain', 'to get'], ['to acquire; to get; to obtain'])).toBe(true);
    expect(sharesMeaning(['horse'], ['to buy'])).toBe(false);
  });
  it('compares pinyin with tones', () => {
    expect(samePinyin('shì', 'Shì')).toBe(true);
    expect(samePinyin('shì', 'shí')).toBe(false);
  });
});
