/** Building blocks shared by exercise components. */
import { createPortal } from 'react-dom';
import { VolumeSlider } from '../../components/VolumeSlider';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Voice } from '../../content/audioPaths';
import { play, realOf } from '../../lib/audio';
import { realSpeaker } from '../../lib/realAudio';
import { markSyllable, type Tone } from '../../lib/pinyin';
import { liveToneMarks } from '../../lib/pinyinLive';
import { TONE_CLASS } from '../../components/Hanzi';
import { Speaker, Turtle } from '../../components/icons';
import { useLesson, useNumberKeys, useReplay } from '../lesson/context';

export function Prompt({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-lg font-semibold text-ink">{children}</h2>;
}

/**
 * Big play button + slow button. Plays once on mount (the user has already
 * tapped to start the lesson, so this never autoplays before a gesture).
 */
/** Speed ladder (CLAUDE.md §3.4): each tap on the speed button plays at the next speed. */
const LADDER = [0.75, 1, 1.2];

export function AudioControls({
  id,
  voice,
  autoPlay = true,
  size = 'lg',
  ladder = false,
  voices,
}: {
  id: string;
  voice?: Voice;
  autoPlay?: boolean;
  size?: 'lg' | 'sm';
  /** Show the 0.75× → 1× → 1.2× speed button. */
  ladder?: boolean;
  /** Several real speakers for this item (Tone Perfect, IDEAS #21): one at random, and "Another voice". */
  voices?: Array<{ url: string; speaker: string }>;
}) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(1);
  const [vi, setVi] = useState(() => Math.floor(Math.random() * (voices?.length || 1)));
  const v = voices?.length ? voices[vi % voices.length] : undefined;
  const go = (slow?: boolean, rate?: number, url = v?.url) => {
    setPlaying(true);
    play(id, { voice, slow, rate, url }).finally(() => setPlaying(false));
  };
  const another = () => {
    if (!voices || voices.length < 2) return;
    const next = (vi + 1) % voices.length;
    setVi(next);
    go(false, undefined, voices[next].url);
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
  const real = realOf(id);
  const speaker = v?.speaker ?? (real && realSpeaker(real));
  return (
    <div className="flex flex-col items-center gap-3">
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => go(false)}
        aria-label="Play audio (space)"
        className={`press flex items-center justify-center rounded-full bg-jade text-jade-ink ${big ? 'h-24 w-24' : 'h-14 w-14'} ${playing ? 'anim-breathe' : ''}`}
      >
        <Speaker className={big ? 'h-11 w-11' : 'h-7 w-7'} />
      </button>
      <button
        type="button"
        onClick={() => go(true)}
        aria-label="Play slowly"
        className={`flex items-center justify-center rounded-full border border-edge bg-surface text-muted transition hover:border-muted hover:text-ink active:scale-90 ${big ? 'h-14 w-14' : 'h-11 w-11'}`}
      >
        <Turtle className={big ? 'h-7 w-7' : 'h-5 w-5'} />
      </button>
      {ladder && (
        <button
          type="button"
          onClick={() => {
            const next = (step + 1) % LADDER.length;
            setStep(next);
            go(false, LADDER[next]);
          }}
          aria-label={`Play at ${LADDER[(step + 1) % LADDER.length]}× speed`}
          title="Speed ladder: 0.75× → 1× → 1.2×"
          className={`flex items-center justify-center rounded-full border border-edge bg-surface text-sm font-semibold tabular-nums text-muted transition hover:border-muted hover:text-ink active:scale-90 ${big ? 'h-14 w-14' : 'h-11 w-11'}`}
        >
          {LADDER[step]}×
        </button>
      )}
    </div>
    {/* A person, not Azure (IDEAS #20, #21); the turtle slows the same recording down. */}
    {speaker && (
      <p className="flex items-center gap-3 text-xs text-muted" title={v ? 'Tone Perfect, Michigan State University Libraries' : `Recorded by ${speaker} (Wikimedia Commons). Credits in Settings → About.`}>
        <span>Real speaker · {speaker}</span>
        {voices && voices.length > 1 && (
          <button type="button" onClick={another} className="-my-2 px-2 py-3 text-sm font-medium text-jade">
            Another voice
          </button>
        )}
      </p>
    )}
    <VolumeSlider />
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
      className="shrink-0 rounded-full bg-jade-soft p-2 text-jade transition active:scale-90"
    >
      <Speaker className="h-5 w-5" />
    </button>
  );
}

/**
 * The main button of a question (Got it, Check, Reveal…) and its "I don't know", pinned to the
 * bottom of the screen so the thumb always finds it in the same place (IDEAS #15). The feedback
 * sheet covers it after answering.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  // In a portal: the question slides in with a transform, which would make this bar "fixed" to the
  // sliding box (mid-screen for a moment) instead of the screen.
  return createPortal(
    // Column-reverse: the main button (first child) is always the bottom row, so it sits in exactly
    // the same spot whether or not an "I don't know" link is shown (that goes above it).
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto flex max-w-xl flex-col-reverse gap-1 lg:max-w-2xl [&>*]:mt-0">{children}</div>
    </div>,
    document.body,
  );
}

export type OptionState = 'idle' | 'selected' | 'right' | 'wrong';

export function optionClass(state: OptionState): string {
  switch (state) {
    case 'selected':
      return 'border-jade bg-jade-soft ring-1 ring-jade';
    // Right and wrong change colour at once (no fade), then pop or shake.
    case 'right':
      return 'border-jade bg-jade-soft anim-nudge !duration-0';
    case 'wrong':
      return 'border-cinnabar bg-cinnabar-soft anim-shake !duration-0';
    default:
      return 'border-edge bg-surface shadow-sm hover:border-muted';
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
            data-state={st}
            disabled={locked}
            onClick={() => onSelect(i)}
            className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition duration-150 active:translate-y-0.5 active:shadow-none disabled:active:translate-y-0 ${extra ? 'flex-1' : ''} ${optionClass(st)}`}
          >
            <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-xs text-muted transition-colors group-aria-selected:border-jade group-aria-selected:bg-jade group-aria-selected:text-jade-ink sm:flex">{i + 1}</span>
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

const TONE_KEYS: Array<{ tone: Tone; label: string; name: string }> = [
  { tone: 1, label: '1', name: '1st tone' },
  { tone: 2, label: '2', name: '2nd tone' },
  { tone: 3, label: '3', name: '3rd tone' },
  { tone: 4, label: '4', name: '4th tone' },
  { tone: 5, label: '5', name: 'neutral tone' },
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
  // Cursor position to restore right after a live tone-mark change (before the next key).
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);
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
        onChange={(e) => {
          const el = e.target;
          const next = el.value;
          // One key typed (not pasted, not an IME): turn "ni3" into "nǐ" right away.
          if (next.length === value.length + 1 && el.selectionStart !== null && !/\p{Script=Han}/u.test(next)) {
            const r = liveToneMarks(next, el.selectionStart);
            if (r.value !== next) {
              pendingCaret.current = r.caret;
              onChange(r.value);
              return;
            }
          }
          onChange(next);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="Your answer in pinyin"
        className="w-full rounded-2xl border border-edge bg-surface px-4 py-4 text-xl outline-none transition-[border-color,box-shadow] duration-200 focus:border-jade focus:shadow-[0_0_0_4px_var(--jade-soft)] disabled:opacity-80"
      />
      <div className="mt-2 flex gap-2" aria-label="Tone marks">
        {TONE_KEYS.map((k) => (
          <button
            key={k.tone}
            type="button"
            disabled={locked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert((v, c) => applyToneAt(v, c, k.tone))}
            className={`h-11 flex-1 rounded-xl border border-edge bg-surface text-xl font-semibold tabular-nums transition hover:border-muted active:scale-95 active:bg-jade-soft ${TONE_CLASS[k.tone]}`}
            aria-label={`${k.name} on the last syllable`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          disabled={locked}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert((v, c) => ({ value: v.slice(0, c) + 'ü' + v.slice(c), caret: c + 1 }))}
          className="h-11 flex-1 rounded-xl border border-edge bg-surface text-xl transition hover:border-muted active:scale-95 active:bg-jade-soft"
          aria-label="Insert ü"
        >
          ü
        </button>
      </div>
    </div>
  );
}
