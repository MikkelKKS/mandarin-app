/** Optional speaking practice: browser speech recognition + pitch tracking. */
import { PitchDetector } from 'pitchy';
import type { Tone } from './pinyin';

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function Ctor(): (new () => Rec) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface Recording {
  stop: () => void;
  result: Promise<{ transcript: string; pitch: PitchPoint[]; error?: string }>;
}

export interface PitchPoint {
  t: number; // seconds
  hz: number;
}

/** Start listening. Resolves with what was heard (zh-CN) and the pitch track. */
export function listen(): Recording {
  const R = Ctor()!;
  const rec = new R();
  rec.lang = 'zh-CN';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  const pitch = startPitch();
  let transcript = '';
  let error: string | undefined;
  const result = new Promise<{ transcript: string; pitch: PitchPoint[]; error?: string }>((resolve) => {
    rec.onresult = (e) => {
      transcript = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join('');
    };
    rec.onerror = (e) => {
      error = e.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in the browser settings.' : e.error === 'no-speech' ? "Didn't hear anything. Try again a bit closer to the mic." : `Speech recognition error: ${e.error}`;
    };
    rec.onend = async () => resolve({ transcript, pitch: await pitch.stop(), error });
  });
  rec.start();
  return { stop: () => rec.stop(), result };
}

/** Records pitch from the microphone until stopped. Fails quietly (empty track). */
function startPitch(): { stop: () => Promise<PitchPoint[]> } {
  const points: PitchPoint[] = [];
  let stopFn: () => void = () => {};
  const ready = (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const t0 = ctx.currentTime;
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
        if (clarity > 0.88 && hz > 60 && hz < 600) points.push({ t: ctx.currentTime - t0, hz });
      }, 25);
      stopFn = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
    } catch {
      /* no pitch track */
    }
  })();
  return {
    stop: async () => {
      await ready;
      stopFn();
      return points;
    },
  };
}

/** Character overlap between what was heard and the target (0–1). */
export function similarity(heard: string, target: string): number {
  const a = [...heard.replace(/[^\p{Script=Han}]/gu, '')];
  const b = [...target.replace(/[^\p{Script=Han}]/gu, '')];
  if (!b.length) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return Math.max(0, 1 - dp[b.length] / b.length);
}

/** Stylised target contour for a tone, as heights 0–1 across the syllable. */
export function toneShape(t: Tone): number[] {
  switch (t) {
    case 1:
      return [0.85, 0.85, 0.85];
    case 2:
      return [0.45, 0.6, 0.85];
    case 3:
      return [0.4, 0.1, 0.45];
    case 4:
      return [0.95, 0.55, 0.15];
    default:
      return [0.4, 0.35, 0.35];
  }
}
