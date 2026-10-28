/**
 * Pitch contours for speaking practice (CLAUDE.md §5): pitch per 10 ms frame
 * with pitchy (McLeod Pitch Method), unvoiced frames dropped, octave jumps
 * and jitter smoothed out, then expressed in semitones relative to the
 * speaker's own median and on a 0–1 time axis, so a male and a female voice,
 * or a fast and a slow one, can be compared.
 */
import { PitchDetector } from 'pitchy';

export interface PitchPoint {
  /** Seconds from the start. */
  t: number;
  hz: number;
}

export interface ContourPoint {
  /** 0–1 across the voiced part. */
  x: number;
  /** Semitones relative to the speaker's median (0 = their middle). */
  st: number;
}

/** Analysis window: 40 ms, short enough to follow a syllable's pitch, long enough for low male voices. */
const WINDOW_S = 0.04;
const STEP_S = 0.01;
const MIN_HZ = 60;
const MAX_HZ = 600;
const CLARITY = 0.7;

/** Pitch of every voiced 10 ms frame of a mono signal. */
export function pitchPoints(samples: Float32Array, sampleRate: number): PitchPoint[] {
  const WINDOW = Math.round(WINDOW_S * sampleRate);
  const detector = PitchDetector.forFloat32Array(WINDOW);
  const step = Math.max(1, Math.round(STEP_S * sampleRate));
  const out: PitchPoint[] = [];
  const frame = new Float32Array(WINDOW);
  for (let i = 0; i + WINDOW <= samples.length; i += step) {
    frame.set(samples.subarray(i, i + WINDOW));
    // Skip near-silence quickly.
    let energy = 0;
    for (let k = 0; k < WINDOW; k += 8) energy += frame[k] * frame[k];
    if (energy / (WINDOW / 8) < 2e-6) continue;
    const [hz, clarity] = detector.findPitch(frame, sampleRate);
    if (clarity >= CLARITY && hz >= MIN_HZ && hz <= MAX_HZ) out.push({ t: (i + WINDOW / 2) / sampleRate, hz });
  }
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Clean a track: fold octave errors back towards the running median, take a
 * 5-point median filter and a 3-point average, and drop tiny islands of voicing.
 */
export function cleanPoints(points: PitchPoint[]): PitchPoint[] {
  if (points.length < 3) return points;
  const mid = median(points.map((p) => p.hz));
  const folded = points.map((p) => {
    let hz = p.hz;
    while (hz > mid * 1.8) hz /= 2;
    while (hz < mid / 1.8) hz *= 2;
    return { ...p, hz };
  });
  const med = folded.map((p, i) => ({ ...p, hz: median(folded.slice(Math.max(0, i - 2), i + 3).map((q) => q.hz)) }));
  const avg = med.map((p, i) => {
    const w = med.slice(Math.max(0, i - 1), i + 2);
    return { ...p, hz: w.reduce((a, q) => a + q.hz, 0) / w.length };
  });
  // Drop voiced runs shorter than 40 ms (clicks, breaths).
  const runs: PitchPoint[][] = [];
  for (const p of avg) {
    const last = runs[runs.length - 1];
    if (last && p.t - last[last.length - 1].t < 0.035) last.push(p);
    else runs.push([p]);
  }
  return runs.filter((r) => r[r.length - 1].t - r[0].t >= 0.04).flat();
}

/** Semitones from the median, on a 0–1 time axis across the voiced part. */
export function normalise(points: PitchPoint[]): ContourPoint[] {
  if (points.length < 2) return [];
  const mid = median(points.map((p) => p.hz));
  const t0 = points[0].t;
  const span = Math.max(1e-3, points[points.length - 1].t - t0);
  return points.map((p) => ({ x: (p.t - t0) / span, st: 12 * Math.log2(p.hz / mid) }));
}

export function contourOf(samples: Float32Array, sampleRate: number): ContourPoint[] {
  return normalise(cleanPoints(pitchPoints(samples, sampleRate)));
}

/** Decode audio (a URL or a recording) to mono samples. */
export async function decodeAudio(source: string | Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const bytes = typeof source === 'string' ? await (await fetch(source)).arrayBuffer() : await source.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(bytes);
    const samples = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) samples[i] += ch[i] / buf.numberOfChannels;
    }
    return { samples, sampleRate: buf.sampleRate };
  } finally {
    void ctx.close();
  }
}

/** Can this browser record from the microphone? */
export const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

export interface MicRecording {
  stop: () => void;
  /** The recording, once stopped (or after `maxMs`). */
  done: Promise<Blob>;
}

/** Record from the microphone, kept on the device (nothing is uploaded). */
export async function recordMic(maxMs = 6000): Promise<MicRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
  return {
    stop: () => {
      clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
    },
    done,
  };
}
