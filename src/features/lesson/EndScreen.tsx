import { useEffect, useRef } from 'react';
import { lookup, words } from '../../content';
import { ToneText } from '../../components/Hanzi';
import type { LessonResult } from './LessonPlayer';

function verdictText(acc: number): { hanzi: string; pinyin: string; line: string } {
  if (acc >= 0.95) return { hanzi: '太棒了', pinyin: 'tài bàng le', line: 'Brilliant, almost no slips.' };
  if (acc >= 0.8) return { hanzi: '很好', pinyin: 'hěn hǎo', line: 'Very good. Keep it rolling.' };
  if (acc >= 0.5) return { hanzi: '不错', pinyin: 'bú cuò', line: 'Not bad! The mistakes will come back in Practice.' };
  return { hanzi: '加油', pinyin: 'jiā yóu', line: "Tough one. Replay it as often as you like." };
}

export function EndScreen({
  result,
  heading,
  extra,
  onContinue,
  onAgain,
}: {
  result: LessonResult;
  heading?: string;
  extra?: string;
  onContinue: () => void;
  onAgain: () => void;
}) {
  const v = verdictText(result.accuracy);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  const mins = Math.floor(result.ms / 60000);
  const secs = Math.round((result.ms % 60000) / 1000);
  const fresh = result.newWords.map((id) => words.get(id)).filter(Boolean);
  const review = result.mistakes.map((id) => ({ id, ...lookup(id)! })).filter((x) => x.hanzi);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="text-center">
        <div className="anim-pop mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 border-cinnabar text-cinnabar" aria-hidden>
          <span className="han text-4xl font-bold leading-tight">{v.hanzi}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{v.pinyin}</p>
        <h1 className="mt-4 text-2xl font-bold">{heading ?? 'Lesson complete'}</h1>
        <p className="mt-1 text-muted">{extra ?? v.line}</p>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-surface p-4">
          <dt className="text-sm text-muted">Accuracy</dt>
          <dd className="text-3xl font-bold text-jade">{Math.round(result.accuracy * 100)}%</dd>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <dt className="text-sm text-muted">Time</dt>
          <dd className="text-3xl font-bold">
            {mins}:{String(secs).padStart(2, '0')}
          </dd>
        </div>
      </dl>

      {fresh.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">New words</h2>
          <div className="flex flex-wrap gap-2">
            {fresh.map((w) => (
              <span key={w!.id} className="rounded-xl bg-surface px-3 py-2">
                <ToneText hanzi={w!.hanzi} pinyin={w!.pinyin} className="han text-xl" />
                <span className="ml-2 text-sm text-muted">{w!.english[0]}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {review.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">To review</h2>
          <ul className="flex flex-col gap-2">
            {review.slice(0, 8).map((r) => (
              <li key={r.id} className="rounded-xl bg-surface px-3 py-2">
                <ToneText hanzi={r.hanzi} pinyin={r.pinyin} className="han text-lg" />
                <span className="ml-2 text-sm text-muted">{r.pinyin}</span>
                {r.english && <span className="block text-sm text-muted">{r.english}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">These come back in Practice.</p>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <button ref={btn} onClick={onContinue} className="h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Continue
        </button>
        <button onClick={onAgain} className="h-12 rounded-2xl border-2 border-line font-medium">
          Play again
        </button>
      </div>
    </div>
  );
}
