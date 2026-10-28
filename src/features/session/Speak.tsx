/**
 * Speaking (CLAUDE.md §5): hear the native recording, record yourself, and
 * compare both pitch contours, time-normalised and in semitones from each
 * speaker's own middle, the native one coloured by the expected tones. Replay
 * A/B, then grade yourself. Recordings stay on the device.
 */
import { useEffect, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { azureUrl, play, playUrl, stop } from '../../lib/audio';
import { parsePinyin, type Tone } from '../../lib/pinyin';
import { contourOf, decodeAudio, recordMic, type ContourPoint, type MicRecording } from '../../lib/pitchTrack';
import { courseIdFor, type RatingName } from '../../lib/review';
import { setSpeakPausedUntil, useSettings } from '../../lib/settings';
import { shortGloss, type VocabData } from '../../lib/vocabData';
import type { ItemResult } from './items';

const BASE = import.meta.env.BASE_URL;
const TONE_COLOR = ['', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)'];
/** Semitones shown above and below the middle: fitted to the curves, at least 3 and at most 10. */
const rangeFor = (...cs: Array<ContourPoint[] | null>) =>
  Math.min(10, Math.max(3, ...cs.flatMap((c) => (c ?? []).map((p) => Math.abs(p.st) * 1.15))));

/** URLs to try for the native recording of a word, best first. */
function nativeUrls(word: string): string[] {
  const course = courseIdFor(word);
  return [azureUrl(word, false), ...(course ? [`${BASE}audio/f/${course}.mp3`, `${BASE}audio/m/${course}.mp3`] : [])];
}

async function nativeContour(word: string): Promise<ContourPoint[]> {
  for (const url of nativeUrls(word)) {
    try {
      const { samples, sampleRate } = await decodeAudio(url);
      const c = contourOf(samples, sampleRate);
      if (c.length > 5) return c;
    } catch {
      /* try the next one */
    }
  }
  return [];
}

/** Two contours on one chart: native (by tone colour, thicker) and yours (ink). */
export function PitchCompare({ native, mine, tones }: { native: ContourPoint[]; mine: ContourPoint[] | null; tones: Tone[] }) {
  const W = 320;
  const H = 150;
  const RANGE = rangeFor(native, mine);
  const y = (st: number) => H / 2 - (Math.max(-RANGE, Math.min(RANGE, st)) / RANGE) * (H / 2 - 8);
  const x = (v: number) => 6 + v * (W - 12);
  const path = (pts: ContourPoint[]) => {
    let d = '';
    pts.forEach((p, i) => {
      const gap = i > 0 && p.x - pts[i - 1].x > 0.06;
      d += `${i === 0 || gap ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.st).toFixed(1)}`;
    });
    return d;
  };
  // Native contour split into equal parts per syllable, each in its tone colour.
  const n = Math.max(1, tones.length);
  const parts = tones.map((t, k) => ({ t, pts: native.filter((p) => p.x >= k / n - 0.01 && p.x <= (k + 1) / n + 0.01) }));
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl bg-surface border border-line" role="img" aria-label="Pitch: the native speaker and you">
        <line x1={6} x2={W - 6} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeWidth={1} />
        {tones.slice(1).map((_, k) => (
          <line key={k} x1={x((k + 1) / n)} x2={x((k + 1) / n)} y1={6} y2={H - 6} stroke="var(--line)" strokeWidth={1} />
        ))}
        {parts.map((p, k) => (
          <path key={k} d={path(p.pts)} fill="none" stroke={TONE_COLOR[p.t]} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {mine && <path d={path(mine)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded" style={{ background: `linear-gradient(90deg, ${tones.map((t) => TONE_COLOR[t]).join(', ')})` }} />
          Native (coloured by tone)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-ink" />
          You
        </span>
        <span>Middle line: each speaker's own middle pitch · height ±{Math.round(RANGE)} semitones</span>
      </figcaption>
    </figure>
  );
}

export function Speak({ data, word, onResult, onNoMic }: { data: VocabData; word: string; onResult: (r: ItemResult) => void; onNoMic: () => void }) {
  const w = data.byId.get(word)!;
  const { showHanzi } = useSettings();
  const tones = (parsePinyin(w.pinyin.replace(/\s+/g, ''), [...w.hanzi].length) ?? parsePinyin(w.pinyin) ?? []).map((s) => s.tone);
  const [native, setNative] = useState<ContourPoint[] | null>(null);
  const [mine, setMine] = useState<ContourPoint[] | null>(null);
  const [blob, setBlob] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'analysing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MicRecording | null>(null);

  useEffect(() => {
    let live = true;
    void nativeContour(word).then((c) => live && setNative(c));
    const t = setTimeout(() => void play(word), 250);
    return () => {
      live = false;
      clearTimeout(t);
      rec.current?.stop();
    };
  }, [word]);
  useEffect(() => () => void (blob && URL.revokeObjectURL(blob)), [blob]);

  const start = async () => {
    setError(null);
    stop();
    try {
      rec.current = await recordMic(Math.max(3000, tones.length * 1200 + 1500));
      setState('recording');
      const b = await rec.current.done;
      setState('analysing');
      const url = URL.createObjectURL(b);
      setBlob(url);
      const { samples, sampleRate } = await decodeAudio(b);
      const c = contourOf(samples, sampleRate);
      setMine(c);
      if (c.length < 5) setError("Couldn't hear much. Try again a little closer to the microphone.");
      setState('idle');
    } catch (e) {
      setState('idle');
      setError((e as Error)?.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the browser settings, or tap "No mic right now".' : "Couldn't use the microphone.");
    }
  };

  const grade = (r: RatingName) =>
    onResult({ outcome: { verdict: r === 'again' ? 'wrong' : r === 'hard' ? 'almost' : 'correct' }, rating: r, skipFeedback: true });

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Say it like the recording</h2>
      <p className="mb-4 text-sm text-muted">Listen, record yourself, then compare the pitch.</p>
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 border border-line">
        <button onClick={() => void play(word)} aria-label="Hear the native recording" className="press rounded-full bg-jade p-3 text-jade-ink">
          <Speaker className="h-6 w-6" />
        </button>
        <div className="min-w-0">
          <TonePinyin pinyin={w.pinyin} className="block text-3xl font-semibold" />
          {showHanzi && (
            <span className="han text-lg text-muted" lang="zh-CN">
              {w.hanzi}
            </span>
          )}
          <p className="text-sm text-muted">{shortGloss(w.gloss)}</p>
        </div>
      </div>

      {native !== null && <PitchCompare native={native} mine={mine} tones={tones} />}
      {native?.length === 0 && <p className="mt-1 text-xs text-muted">No pitch curve for this recording yet.</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => (state === 'recording' ? rec.current?.stop() : void start())}
          disabled={state === 'analysing'}
          className={`press h-14 flex-1 rounded-2xl text-lg font-semibold ${state === 'recording' ? 'anim-breathe bg-cinnabar text-white' : 'bg-jade text-jade-ink'}`}
        >
          {state === 'recording' ? 'Stop' : state === 'analysing' ? 'Analysing…' : mine ? 'Record again' : 'Record'}
        </button>
        {blob && (
          <>
            <button onClick={() => void play(word)} className="h-14 rounded-2xl border border-line px-4 font-medium">
              A: native
            </button>
            <button onClick={() => void playUrl(blob)} className="h-14 rounded-2xl border border-line px-4 font-medium">
              B: you
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-cinnabar">{error}</p>}

      {mine && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-muted">How close was it?</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Grade yourself">
            {(
              [
                ['again', 'Again', 'Off'],
                ['hard', 'Hard', 'Close-ish'],
                ['good', 'Good', 'Close'],
                ['easy', 'Easy', 'Spot on'],
              ] as Array<[RatingName, string, string]>
            ).map(([r, label, hint]) => (
              <button key={r} onClick={() => grade(r)} className="flex h-16 flex-col items-center justify-center rounded-2xl border border-line bg-surface font-semibold active:scale-95">
                {label}
                <span className="text-[11px] font-normal text-muted">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          void setSpeakPausedUntil(Date.now() + 3600_000);
          onNoMic();
        }}
        className="mt-6 w-full text-sm font-medium text-muted underline underline-offset-2"
      >
        No mic right now (skip speaking for an hour)
      </button>
    </div>
  );
}
