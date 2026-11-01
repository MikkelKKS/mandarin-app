/** Grammar sentences on screen: pinyin first, characters as set in Settings ("Sentences in exercises"). */
import progress from 'virtual:audio-progress';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { playUrl } from '../../lib/audio';
import { hanziOf, pinyinOf } from '../../lib/grammarTopics';
import { updateSettings, useSettings } from '../../lib/settings';

const recorded = new Set(progress.grammar ?? []);
export const hasGrammarAudio = (id: string) => recorded.has(id);
export const playGrammar = (id: string) => (recorded.has(id) ? playUrl(`${import.meta.env.BASE_URL}audio/az/${id}.mp3`) : Promise.resolve(false));

/** A sentence in pinyin and/or characters. */
export function GLine({ line, className = '', size = 'md' }: { line: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const { sentenceScript } = useSettings();
  const py = sentenceScript !== 'hanzi';
  const han = sentenceScript !== 'pinyin';
  const pySize = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-base' : 'text-lg';
  const hanSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  return (
    <span className={`block ${className}`}>
      {py && <TonePinyin pinyin={pinyinOf(line)} className={`block leading-snug ${pySize}`} />}
      {han && (
        <span className={`han block leading-snug ${py ? `text-muted ${size === 'lg' ? 'text-xl' : 'text-base'}` : hanSize}`} lang="zh-CN">
          {hanziOf(line)}
        </span>
      )}
    </span>
  );
}

/** A small play button, only when the sentence has been recorded (never the browser's voice). */
export function GPlay({ id, label = 'Play' }: { id: string; label?: string }) {
  if (!recorded.has(id)) return null;
  return (
    <button onClick={() => void playGrammar(id)} aria-label={label} className="shrink-0 rounded-full bg-jade-soft p-2 text-jade active:scale-90">
      <Speaker className="h-4 w-4" />
    </button>
  );
}

/** Pinyin / Both / Characters, the same setting as in Settings (shown on grammar pages, where characters often matter). */
export function ScriptSwitch() {
  const s = useSettings();
  const opts = [
    { v: 'pinyin', label: 'Pinyin' },
    { v: 'both', label: 'Both' },
    { v: 'hanzi', label: 'Characters' },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Show sentences in" className="inline-flex rounded-xl bg-sunk p-0.5 text-sm">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={s.sentenceScript === o.v}
          onClick={() => void updateSettings({ sentenceScript: o.v })}
          className={`rounded-[10px] px-3 py-1.5 font-medium ${s.sentenceScript === o.v ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
