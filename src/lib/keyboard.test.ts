import { describe, expect, it } from 'vitest';
import { keyboardOpen, revealOffset } from './keyboard';

describe('keyboardOpen', () => {
  it('sees the keyboard when the view shrank from the tallest seen', () => {
    expect(keyboardOpen(450, 860, 412, 412, 915)).toBe(true);
    expect(keyboardOpen(840, 860, 412, 412, 915)).toBe(false);
  });
  it('sees it even if the full height was measured with the keyboard already open', () => {
    expect(keyboardOpen(450, 450, 412, 412, 915)).toBe(true);
  });
  it('uses the short side as the height in landscape', () => {
    expect(keyboardOpen(380, 380, 915, 412, 915)).toBe(false);
    expect(keyboardOpen(200, 380, 915, 412, 915)).toBe(true);
  });
});

describe('revealOffset', () => {
  it('scrolls the field up until it ends above the bar', () => {
    expect(revealOffset(500, 600, 450, 60)).toBe(158);
  });
  it('leaves a visible field alone', () => {
    expect(revealOffset(200, 300, 450, 60)).toBe(0);
  });
  it('never pushes the field under the header', () => {
    expect(revealOffset(100, 600, 450, 60)).toBe(40);
  });
});
