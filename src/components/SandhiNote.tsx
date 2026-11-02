/**
 * One line under an answer when its tones change in speech (IDEAS #4):
 * "Said as ní hǎo. A 3rd tone before another 3rd is said as a 2nd."
 * The answer itself keeps dictionary tones.
 */
import { Fragment, useMemo } from 'react';
import { sentenceSandhi } from '../lib/sandhi';
import { TonePinyin } from './Hanzi';

export function SandhiNote({ hanzi, pinyin, className = '' }: { hanzi?: string; pinyin?: string; className?: string }) {
  const s = useMemo(() => (hanzi && pinyin ? sentenceSandhi(hanzi, pinyin) : null), [hanzi, pinyin]);
  if (!s) return null;
  return (
    <p className={`mt-1 text-sm opacity-80 ${className}`}>
      Said as{' '}
      {s.changes.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          <TonePinyin pinyin={c.to} className="font-medium" />
        </Fragment>
      ))}
      . {s.rules.join(' ')}
    </p>
  );
}
