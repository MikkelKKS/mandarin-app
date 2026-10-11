import { useEffect, useRef } from 'react';
import { lookup, words } from '../../content';
import { ToneText } from '../../components/Hanzi';
import type { LessonResult } from './LessonPlayer';

/** A verdict in words, based on how many answers were right first time. */
export function verdictText(firstTry: number): { hanzi: string; pinyin: string; title: string; line: string } {
  if (firstTry >= 0.95) return { hanzi: '完美', pinyin: 'wánměi', title: 'Flawless', line: 'Every answer right on the first go.' };
  if (firstTry >= 0.8) return { hanzi: '很棒', pinyin: 'hěn bàng', title: 'Strong work', line: 'A few slips, and you fixed every one.' };
  if (firstTry >= 0.6) return { hanzi: '不错', pinyin: 'búcuò', title: 'Solid progress', line: 'You stuck with the tricky ones until they clicked.' };
  if (firstTry >= 0.4) return { hanzi: '有进步', pinyin: 'yǒu jìnbù', title: 'Good effort', line: 'Lots of new material here. The next round will feel easier.' };
  return { hanzi: '加油', pinyin: 'jiāyóu', title: 'You got through it', line: 'A tough one, and you finished it. The tricky words are waiting in Practice.' };
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
  const fixed = result.mistakes.length;
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
        <h1 className="mt-4 text-2xl font-bold">{heading ?? v.title}</h1>
        <p className="mt-1 text-muted">{extra ?? v.line}</p>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-surface p-4">
          <dt className="text-sm text-muted">Time</dt>
          <dd className="text-2xl font-bold">
            {mins}:{String(secs).padStart(2, '0')}
          </dd>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <dt className="text-sm text-muted">Fixed along the way</dt>
          <dd className="text-2xl font-bold">{fixed === 0 ? 'Nothing' : fixed === 1 ? '1 item' : `${fixed} items`}</dd>
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
          <h2 className="mb-2 font-semibold">Coming back in Practice</h2>
          <ul className="flex flex-col gap-2">
            {review.slice(0, 8).map((r) => (
              <li key={r.id} className="rounded-xl bg-surface px-3 py-2">
                <ToneText hanzi={r.hanzi} pinyin={r.pinyin} className="han text-lg" />
                <span className="ml-2 text-sm text-muted">{r.pinyin}</span>
                {r.english && <span className="block text-sm text-muted">{r.english}</span>}
              </li>
            ))}
          </ul>
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
