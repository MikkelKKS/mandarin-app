/** "Learn next" for a dictionary entry: HSK words go to the front of your new words. */
import { dontLearnNext, learnNext, useLearnState } from '../features/dictionary/mywords';
import { Check } from './icons';

export function LearnNext({ entry, className = '' }: { entry: { hanzi: string; pinyin: string }; className?: string }) {
  const { word, state } = useLearnState(entry);
  if (state === 'not-hsk' || !word) return null;
  const base = `inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${className}`;
  if (state === 'started') return <span className={`${base} bg-sunk text-muted`}>In your reviews</span>;
  if (state === 'queued')
    return (
      <button onClick={() => void dontLearnNext(word.id)} className={`${base} bg-jade-soft text-jade`} aria-pressed title="Tap to take it off the list">
        <Check className="h-3.5 w-3.5" /> Learning next
      </button>
    );
  return (
    <button onClick={() => void learnNext(word.id)} className={`${base} border border-line bg-surface hover:border-jade`}>
      Learn next
    </button>
  );
}
