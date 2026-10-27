import { describe, expect, it } from 'vitest';
import { meaningMatches } from './meaning';

describe('typed meanings', () => {
  it('accepts close enough answers', () => {
    expect(meaningMatches('colleague', ['colleague; co-worker'])).toBe(true);
    expect(meaningMatches('coworker', ['colleague; co-worker'])).toBe(true);
    expect(meaningMatches('co-worker', ['colleague; co-worker'])).toBe(true);
    expect(meaningMatches('to eat', ['to eat; to consume'])).toBe(true);
    expect(meaningMatches('eat', ['to eat'])).toBe(true);
    expect(meaningMatches('Thank you!', ['to thank; thanks'])).toBe(true);
    expect(meaningMatches('mother', ['mom (informal)', 'mother'])).toBe(true);
    expect(meaningMatches('running', ['to run'])).toBe(true);
  });
  it('rejects different meanings', () => {
    expect(meaningMatches('father', ['mother'])).toBe(false);
    expect(meaningMatches('', ['mother'])).toBe(false);
    expect(meaningMatches('the', ['the'])).toBe(false);
  });
});
