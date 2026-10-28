/** A small card next to a tapped word: reading, meaning, audio, add to practice. No backdrop. */
import { GrammarToggle } from './GrammarNote';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ReportAudio } from './ReportAudio';
import { TonePinyin, ToneText } from './Hanzi';
import { Close, Speaker } from './icons';
import { play } from '../lib/audio';
import { plecoLink, type Entry } from '../features/dictionary/dict';
import { LearnNext } from './LearnNext';

/** A small card next to the tapped word. No backdrop, so the song and lyrics stay visible. */
export function WordPopover({
  text,
  entry,
  known = false,
  gloss,
  audioId,
  anchor,
  onClose,
}: {
  text: string;
  entry?: Entry;
  known?: boolean;
  /** Used when there's no dictionary entry (e.g. a story's extra word). */
  gloss?: { pinyin: string; english: string };
  /** A recording to play instead of the browser voice. */
  audioId?: string;
  anchor: DOMRect;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const e: Entry | undefined = entry;
  useEffect(() => {
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && close.current();
    // Tapping anywhere else closes it (the tap on another word then opens that one).
    const down = (ev: PointerEvent) => {
      if (!box.current?.contains(ev.target as Node)) close.current();
    };
    window.addEventListener('keydown', key);
    const t = setTimeout(() => document.addEventListener('pointerdown', down), 0);
    return () => {
      window.removeEventListener('keydown', key);
      clearTimeout(t);
      document.removeEventListener('pointerdown', down);
    };
  }, []);
  const say = () => {
    if (audioId) return void play(audioId);
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  // Place it below the word (or above when there's no room), inside the screen, in page coordinates so it scrolls with the lyrics.
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 12)) + window.scrollX;
  const below = anchor.bottom + 230 < window.innerHeight;
  const top = (below ? anchor.bottom + 8 : anchor.top - 8) + window.scrollY;
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={text}
      className="anim-pop absolute z-40 rounded-2xl border border-line bg-surface p-4 shadow-xl"
      style={{ left, top, width, transform: below ? undefined : 'translateY(-100%)' }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {e ? <ToneText hanzi={e.hanzi} pinyin={e.pinyin} className="han text-3xl" /> : <span className="han text-3xl">{text}</span>}
          {e ? <TonePinyin pinyin={e.pinyin} className="ml-2 text-base" /> : gloss && <TonePinyin pinyin={gloss.pinyin} className="ml-2 text-base" />}
          {e && e.hsk > 0 && <span className="ml-2 rounded-md bg-sunk px-1.5 py-0.5 align-middle text-xs text-muted">HSK {e.hsk}</span>}
        </div>
        <button onClick={say} aria-label={`Hear ${text}`} className="rounded-full bg-jade-soft p-2 text-jade">
          <Speaker className="h-4 w-4" />
        </button>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-sunk">
          <Close className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{e ? e.defs.slice(0, 4).join('; ') : gloss ? gloss.english : 'Not in the dictionary.'}</p>
      {known && <p className="mt-1 text-xs text-jade">You know this one.</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {e && <LearnNext entry={e} />}
        {e && <GrammarToggle word={e} />}
        <a href={plecoLink(text)} className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:border-ink/30">
          Open in Pleco
        </a>
      </div>
      {audioId && <ReportAudio id={audioId} hanzi={e?.hanzi ?? text} pinyin={e?.pinyin} className="mt-2 block text-muted" />}
    </div>,
    document.body,
  );
}

