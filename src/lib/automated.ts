/**
 * Silence in automated browsers. Playwright and other automation set
 * `navigator.webdriver`; then the app makes no sound at all: every <audio> is
 * muted (it still plays, so tests can see audio start), the browser's voice is
 * skipped and the sound effects are off. Normal browsers have webdriver false,
 * so real use is never affected.
 */
export const AUTOMATED = typeof navigator !== 'undefined' && navigator.webdriver === true;

/** Mute an audio element in an automated browser (it still plays and fires its events). */
export function silenceIfAutomated<T extends HTMLMediaElement>(a: T): T {
  if (AUTOMATED) {
    a.muted = true;
    a.volume = 0;
  }
  return a;
}
