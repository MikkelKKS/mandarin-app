/** "Look up" after answering: opens the dictionary over the lesson, with the answer already searched. */
import { useState } from 'react';
import { DictionarySheet } from '../features/dictionary/DictionaryView';
import { Search } from './icons';

export function LookUp({ text, pinyin, className = '' }: { text: string; pinyin?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 ${className}`}>
        <Search className="h-3.5 w-3.5" /> Look up
      </button>
      {open && <DictionarySheet query={text.trim()} pinyin={pinyin} onClose={() => setOpen(false)} />}
    </>
  );
}

/** In the header of every exercise screen: open the dictionary over it, at any time (the exercise waits underneath). */
export function DictionaryButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open the dictionary" title="Dictionary" className={`rounded-full p-2 text-muted hover:bg-sunk hover:text-ink ${className}`}>
        <Search className="h-5 w-5" />
      </button>
      {open && <DictionarySheet query="" onClose={() => setOpen(false)} />}
    </>
  );
}
