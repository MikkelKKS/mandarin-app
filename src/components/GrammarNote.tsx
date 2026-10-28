/** A short grammar note for a function word: what it does, and one example to hear. */
import { useState } from 'react';
import { play, rememberText } from '../lib/audio';
import { grammarFor, type GrammarNote } from '../lib/grammar';
import { useSettings } from '../lib/settings';
import { TonePinyin } from './Hanzi';
import { Lightbulb, Speaker } from './icons';

export function GrammarNoteCard({ note, className = '' }: { note: GrammarNote; className?: string }) {
  const { showHanzi } = useSettings();
  rememberText(note.id, note.zh);
  return (
    <section className={`rounded-2xl border border-gold/40 bg-amber-soft/60 p-4 text-left ${className}`} aria-label={`Grammar: ${note.title}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Lightbulb className="h-4 w-4 text-gold" />
        {note.title}
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{note.note}</p>
      <div className="mt-3 flex items-start gap-3">
        <button onClick={() => void play(note.id)} aria-label="Play the example" className="shrink-0 rounded-full bg-surface p-2 text-jade shadow-sm">
          <Speaker className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <TonePinyin pinyin={note.py} className="block text-lg" />
          {showHanzi && (
            <span className="han block text-muted" lang="zh-CN">
              {note.zh}
            </span>
          )}
          <p className="text-sm text-muted">{note.en}</p>
        </div>
      </div>
    </section>
  );
}

/** A "Grammar" button that opens the note in place; renders nothing for words without one. */
export function GrammarToggle({ word, className = '' }: { word: { hanzi: string; pinyin: string }; className?: string }) {
  const note = grammarFor(word);
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:border-ink/30 ${className}`}>
        <Lightbulb className="h-4 w-4 text-gold" />
        Grammar
      </button>
      {open && <GrammarNoteCard note={note} className="anim-fade mt-2 w-full basis-full" />}
    </>
  );
}
