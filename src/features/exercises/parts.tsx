/** Building blocks shared by exercise components. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Voice } from '../../content/audioPaths';
import { play } from '../../lib/audio';
import { markSyllable, type Tone } from '../../lib/pinyin';
import { Speaker, Turtle } from '../../components/icons';
import { useLesson, useNumberKeys, useReplay } from '../lesson/context';

export function Prompt({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-lg font-semibold text-ink sm:text-xl">{children}</h2>;
}

/**
 * Big play button + slow button. Plays once on mount (the user has already
 * tapped to start the lesson, so this never autoplays before a gesture).
 */
export function AudioControls({ id, voice, autoPlay = true, size = 'lg' }: { id: string; voice?: Voice; autoPlay?: boolean; size?: 'lg' | 'sm' }) {
  const [playing, setPlaying] = useState(false);
  const go = (slow?: boolean) => {
    setPlaying(true);
    play(id, { voice, slow }).finally(() => setPlaying(false));
  };
  useReplay(() => go());
  const did = useRef(false);
  useEffect(() => {
    if (autoPlay && !did.current) {
      did.current = true;
      const t = setTimeout(() => go(), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const big = size === 'lg';
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => go(false)}
        aria-label="Play audio (space)"
        className={`flex items-center justify-center rounded-full bg-jade text-jade-ink shadow-md transition active:scale-95 ${big ? 'h-24 w-24' : 'h-14 w-14'} ${playing ? 'ring-4 ring-jade/30' : ''}`}
      >
        <Speaker className={big ? 'h-11 w-11' : 'h-7 w-7'} />
      </button>
      <button
        type="button"
        onClick={() => go(true)}
        aria-label="Play slowly"
        className={`flex items-center justify-center rounded-full border-2 border-line bg-surface text-muted transition active:scale-95 ${big ? 'h-14 w-14' : 'h-11 w-11'}`}
      >
        <Turtle className={big ? 'h-7 w-7' : 'h-5 w-5'} />
      </button>
    </div>
  );
}

/** Small inline play button (e.g. on option cards). */
export function MiniPlay({ id, voice, label = 'Play' }: { id: string; voice?: Voice; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        play(id, { voice });
      }}
      className="shrink-0 rounded-full bg-jade-soft p-2 text-jade"
    >
      <Speaker className="h-5 w-5" />
    </button>
  );
}

export type OptionState = 'idle' | 'selected' | 'right' | 'wrong';

export function optionClass(state: OptionState): string {
  switch (state) {
    case 'selected':
      return 'border-jade bg-jade-soft';
    case 'right':
      return 'border-jade bg-jade-soft';
    case 'wrong':
      return 'border-cinnabar bg-cinnabar-soft anim-shake';
    default:
      return 'border-line bg-surface hover:border-muted';
  }
}

/** Vertical list of choices; number keys pick. */
export function Options({
  count,
  selected,
  onSelect,
  render,
  stateOf,
  grid = false,
  aside,
}: {
  count: number;
  selected: number | null;
  onSelect: (i: number) => void;
  render: (i: number) => ReactNode;
  stateOf?: (i: number) => OptionState;
  grid?: boolean;
  /** Controls shown beside each option (e.g. a play button). Kept outside the option button so they stay clickable. */
  aside?: (i: number) => ReactNode;
}) {
  const { locked } = useLesson();
  useNumberKeys(count, onSelect, !locked);
  return (
    <div className={grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'} role="listbox">
      {Array.from({ length: count }, (_, i) => {
        const st = stateOf?.(i) ?? (selected === i ? 'selected' : 'idle');
        const extra = aside?.(i);
        const btn = (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={selected === i}
            disabled={locked}
            onClick={() => onSelect(i)}
            className={`group flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${extra ? 'flex-1' : ''} ${optionClass(st)}`}
          >
            <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-xs text-muted sm:flex">{i + 1}</span>
            <span className="min-w-0 flex-1">{render(i)}</span>
          </button>
        );
        return extra ? (
          <div key={i} className="flex items-center gap-2">
            {btn}
            {extra}
          </div>
        ) : (
          btn
        );
      })}
    </div>
  );
}

const TONE_KEYS: Array<{ tone: Tone; label: string }> = [
  { tone: 1, label: 'ā' },
  { tone: 2, label: 'á' },
  { tone: 3, label: 'ǎ' },
  { tone: 4, label: 'à' },
];

/** Apply a tone mark to the syllable just before the caret. */
export function applyToneAt(value: string, caret: number, tone: Tone): { value: string; caret: number } {
  const before = value.slice(0, caret);
  const m = before.match(/([a-zA-ZüÜvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)$/);
  if (!m) return { value, caret };
  const raw = m[1];
  // Strip existing marks, remember capitalisation.
  const plain = raw.normalize('NFD').replace(/[̀-ͯ]/g, (c) => (c === '̈' ? '̈' : '')).normalize('NFC');
  const base = plain.toLowerCase().replace(/ü/g, 'v');
  let marked = markSyllable({ base, tone });
  if (/^[A-Z]/.test(raw)) marked = marked[0].toUpperCase() + marked.slice(1);
  const start = caret - raw.length;
  return { value: value.slice(0, start) + marked + value.slice(caret), caret: start + marked.length };
}

/** Text input for pinyin with a tone helper row for phone keyboards. */
export function PinyinInput({
  value,
  onChange,
  placeholder = 'Type in pinyin, e.g. ni3 hao3',
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { locked } = useLesson();
  const ref = useRef<HTMLInputElement>(null);
  const insert = (fn: (v: string, caret: number) => { value: string; caret: number }) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const r = fn(value, caret);
    onChange(r.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.caret, r.caret);
    });
  };
  return (
    <div>
      <input
        ref={ref}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="Your answer in pinyin"
        className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-4 text-xl outline-none focus:border-jade disabled:opacity-80"
      />
      <div className="mt-2 flex gap-2" aria-label="Tone marks">
        {TONE_KEYS.map((k) => (
          <button
            key={k.tone}
            type="button"
            disabled={locked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert((v, c) => applyToneAt(v, c, k.tone))}
            className="h-11 flex-1 rounded-xl border border-line bg-surface text-xl"
            aria-label={`Tone ${k.tone} on the last syllable`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          disabled={locked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert((v, c) => ({ value: v.slice(0, c) + 'ü' + v.slice(c), caret: c + 1 }))}
          className="h-11 flex-1 rounded-xl border border-line bg-surface text-xl"
          aria-label="Insert ü"
        >
          ü
        </button>
      </div>
    </div>
  );
}
