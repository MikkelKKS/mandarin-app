import { useState } from 'react';
import { sentences, words } from '../../content';
import { SentenceText } from '../../components/Hanzi';
import { hanziOnly, parsePinyin, type Tone } from '../../lib/pinyin';
import { listen, similarity, toneShape, type PitchPoint, type Recording } from '../../lib/speech';
import { useCheck } from '../lesson/context';
import type { Exercise } from '../lesson/types';
import { AudioControls, Prompt } from './parts';

type Of<K extends Exercise['kind']> = Extract<Exercise, { kind: K }>;

/** Repeat after me: informational feedback only, never blocks progress. */
export function Repeat({ ex }: { ex: Of<'repeat'> }) {
  const item = sentences.get(ex.itemId) ?? words.get(ex.itemId)!;
  const hanzi = item.hanzi;
  const pinyin = item.pinyin;
  const tones = (parsePinyin(pinyin, [...hanziOnly(hanzi)].length) ?? []).map((s) => s.tone);
  const [rec, setRec] = useState<Recording | null>(null);
  const [res, setRes] = useState<{ transcript: string; pitch: PitchPoint[]; error?: string } | null>(null);
  useCheck(() => ({ verdict: 'correct', items: [] }), [ex.key]);

  const start = () => {
    setRes(null);
    const r = listen();
    setRec(r);
    r.result.then((x) => {
      setRes(x);
      setRec(null);
    });
  };
  const score = res && !res.error ? similarity(res.transcript, hanzi) : null;

  return (
    <div>
      <Prompt>Repeat after me</Prompt>
      <div className="mb-4 rounded-2xl bg-sunk p-4">
        {'words' in item && Array.isArray(item.words) ? <SentenceText sentence={item as never} size="text-3xl" pinyin /> : <span className="han text-4xl">{hanzi}</span>}
        <p className="mt-2 text-muted">{'english' in item ? (Array.isArray(item.english) ? item.english[0] : item.english) : ''}</p>
      </div>
      <AudioControls id={ex.itemId} voice={ex.voice} />
      <div className="mt-8 flex flex-col items-center">
        <button
          onClick={() => (rec ? rec.stop() : start())}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-md ${rec ? 'anim-breathe bg-cinnabar' : 'bg-ink'}`}
          aria-label={rec ? 'Stop recording' : 'Tap and speak'}
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <p className="mt-2 text-sm text-muted">{rec ? 'Listening… tap to stop' : res ? 'Tap to try again' : 'Tap and say it'}</p>
      </div>
      {res && (
        <div className="mt-6 rounded-2xl bg-surface p-4">
          {res.error ? (
            <p className="text-sm">{res.error}</p>
          ) : (
            <>
              <p className="text-sm text-muted">Heard</p>
              <p className="han text-2xl">{res.transcript || '…'}</p>
              {score !== null && (
                <p className="mt-1 text-sm">
                  {score >= 0.99 ? 'Spot on!' : score >= 0.6 ? 'Close. Most of it came through.' : 'Not recognised. Listen again and try once more.'}{' '}
                  <span className="text-muted">({Math.round(score * 100)}% of the characters matched)</span>
                </p>
              )}
            </>
          )}
          {res.pitch.length > 5 && <PitchChart points={res.pitch} tones={tones} />}
        </div>
      )}
    </div>
  );
}

function PitchChart({ points, tones }: { points: PitchPoint[]; tones: Tone[] }) {
  const W = 300;
  const H = 110;
  const semis = points.map((p) => 12 * Math.log2(p.hz));
  const lo = Math.min(...semis);
  const hi = Math.max(...semis);
  const span = Math.max(4, hi - lo);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t || 1;
  const user = points.map((p, i) => `${(((p.t - t0) / (t1 - t0 || 1)) * W).toFixed(1)},${(H - 8 - ((semis[i] - lo) / span) * (H - 16)).toFixed(1)}`).join(' ');
  const seg = W / Math.max(1, tones.length);
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Your pitch compared with the target tones">
        {tones.map((t, i) => {
          const pts = toneShape(t)
            .map((h, k, arr) => `${(i * seg + (k / (arr.length - 1)) * seg * 0.8 + seg * 0.1).toFixed(1)},${(H - 8 - h * (H - 16)).toFixed(1)}`)
            .join(' ');
          return <polyline key={i} points={pts} fill="none" stroke="var(--line)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        <polyline points={user} fill="none" stroke="var(--jade)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <figcaption className="text-xs text-muted">Grey: the tone shapes of the phrase. Green: your voice's pitch.</figcaption>
    </figure>
  );
}
