/**
 * Syllable-by-syllable result of a typed answer: the right syllable in its
 * tone colour on top, and underneath what was typed when it was off.
 */
import type { SyllableFeedback } from '../lib/pinyinAnswer';
import type { Tone } from '../lib/pinyin';
import { useSettings } from '../lib/settings';
import { TONE_CLASS } from './Hanzi';

const toneClass = (on: boolean, t?: number | null) => (on && t ? TONE_CLASS[t as Tone] : '');

export function SyllableBreakdown({ syllables, extra = [] }: { syllables: SyllableFeedback[]; extra?: string[] }) {
  const { toneColors } = useSettings();
  if (!syllables.some((s) => s.status !== 'ok') && extra.length === 0) return null;
  return (
    <div className="mt-3" aria-label="Your answer, syllable by syllable">
      <ol className="flex flex-wrap gap-1.5">
        {syllables.map((s, i) => {
          const ok = s.status === 'ok';
          return (
            <li
              key={i}
              className={`flex min-w-[3rem] flex-col items-center rounded-lg px-2 py-1 ${ok ? 'bg-surface/50' : 'bg-surface ring-2 ring-cinnabar/60'}`}
            >
              <span className={`text-lg font-semibold leading-tight ${toneClass(toneColors, s.tone)}`}>{s.expected}</span>
              <span className="text-xs leading-tight">
                {ok && <span className="opacity-50">✓</span>}
                {s.status === 'wrong-tone' && (
                  <span>
                    you: <span className={`font-semibold ${toneClass(toneColors, s.given)}`}>{s.typed}</span>
                  </span>
                )}
                {s.status === 'missing' && <span className="opacity-80">no tone</span>}
                {s.status === 'wrong-syllable' && (
                  <span>
                    you: <span className="font-semibold line-through decoration-cinnabar decoration-2">{s.typed}</span>
                  </span>
                )}
                {s.status === 'skipped' && <span className="opacity-80">left out</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {extra.length > 0 && (
        <p className="mt-1.5 text-sm">
          Not in the answer: <span className="font-semibold line-through decoration-cinnabar decoration-2">{extra.join(' ')}</span>
        </p>
      )}
    </div>
  );
}
