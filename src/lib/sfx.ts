/** Tiny synthesized sound effects (no audio files needed). */
import { currentSettings } from './settings';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function ready(): boolean {
  if (!currentSettings().sound) return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export const sfx = {
  correct() {
    if (!ready()) return;
    tone(784, 0, 0.12, 'triangle');
    tone(1175, 0.08, 0.22, 'triangle');
  },
  almost() {
    if (!ready()) return;
    tone(660, 0, 0.14, 'triangle', 0.09);
    tone(784, 0.1, 0.18, 'triangle', 0.09);
  },
  wrong() {
    if (!ready()) return;
    tone(220, 0, 0.25, 'sine', 0.14);
    tone(196, 0.1, 0.3, 'sine', 0.1);
  },
  tap() {
    if (!ready()) return;
    tone(1000, 0, 0.04, 'sine', 0.05);
  },
  finish() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.1));
  },
};
