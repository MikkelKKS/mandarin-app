import { describe, expect, it } from 'vitest';
import { cleanPoints, contourOf, normalise, pitchPoints, type PitchPoint } from './pitchTrack';

const RATE = 16000;

/** A tone gliding from f0 to f1 Hz over `seconds`, with silence around it. */
function glide(f0: number, f1: number, seconds: number, pad = 0.2): Float32Array {
  const n = Math.round(seconds * RATE);
  const p = Math.round(pad * RATE);
  const out = new Float32Array(n + 2 * p);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / n;
    phase += (2 * Math.PI * f) / RATE;
    out[p + i] = 0.5 * Math.sin(phase) + 0.2 * Math.sin(2 * phase);
  }
  return out;
}

describe('pitch contours', () => {
  it('finds the pitch of voiced frames and skips silence', () => {
    const pts = pitchPoints(glide(200, 200, 0.5), RATE);
    expect(pts.length).toBeGreaterThan(30);
    expect(pts.every((p) => Math.abs(p.hz - 200) < 6)).toBe(true);
    expect(pts[0].t).toBeGreaterThan(0.15);
  });
  it('shows a rising tone as rising and a falling one as falling', () => {
    const up = contourOf(glide(150, 260, 0.5), RATE);
    const down = contourOf(glide(300, 160, 0.5), RATE);
    expect(up[up.length - 1].st - up[0].st).toBeGreaterThan(5);
    expect(down[down.length - 1].st - down[0].st).toBeLessThan(-5);
  });
  it('puts male and female voices on the same scale', () => {
    const male = contourOf(glide(100, 150, 0.5), RATE);
    const female = contourOf(glide(200, 300, 0.5), RATE);
    expect(Math.abs(male[0].st - female[0].st)).toBeLessThan(0.8);
    expect(Math.abs(male[male.length - 1].st - female[female.length - 1].st)).toBeLessThan(0.8);
  });
  it('folds octave errors and drops clicks', () => {
    const pts: PitchPoint[] = Array.from({ length: 30 }, (_, i) => ({ t: 0.3 + i * 0.01, hz: 200 }));
    pts[10] = { t: pts[10].t, hz: 400 }; // octave error
    pts.push({ t: 1.2, hz: 500 }); // a click far away
    const clean = cleanPoints(pts);
    expect(clean.every((p) => Math.abs(p.hz - 200) < 1)).toBe(true);
    expect(clean.length).toBe(30);
  });
  it('follows real recordings: level 1st, rising 2nd, falling 4th', async () => {
    const { execFileSync, spawnSync } = await import('node:child_process');
    if (spawnSync('ffmpeg', ['-version']).status !== 0) return; // no ffmpeg here (e.g. CI)
    const load = (f: string) => {
      const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', f, '-ac', '1', '-ar', '24000', '-f', 'f32le', '-']);
      return contourOf(new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), 24000);
    };
    const rise = (c: ReturnType<typeof contourOf>) => c[c.length - 1].st - c[0].st;
    const dir = 'public/audio/az/';
    const fs = await import('node:fs');
    if (!fs.existsSync(`${dir}ren2-ce7te.mp3`)) return; // recordings not in this checkout
    expect(rise(load(`${dir}ren2-ce7te.mp3`))).toBeGreaterThan(3); // 人 rén
    expect(rise(load(`${dir}zai4-mjxel.mp3`))).toBeLessThan(-3); // 在 zài
    expect(Math.abs(rise(load(`${dir}shuo1-3fqll.mp3`)))).toBeLessThan(1); // 说 shuō
  });
  it('maps time to 0–1', () => {
    const c = normalise([
      { t: 1, hz: 200 },
      { t: 2, hz: 200 },
      { t: 3, hz: 200 },
    ]);
    expect(c.map((p) => p.x)).toEqual([0, 0.5, 1]);
    expect(c.every((p) => p.st === 0)).toBe(true);
  });
});
