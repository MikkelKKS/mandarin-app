/** Which direction the Reading tab trains, remembered on this device. */
import type { ReadMode } from '../../lib/reading';

const KEY = 'reading:mode';
export function readMode(): ReadMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'rp' || v === 'rm' || v === 'mix' ? v : 'mix';
  } catch {
    return 'mix';
  }
}
export function setReadMode(m: ReadMode): void {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    // private mode: not remembered
  }
}
