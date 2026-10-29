/** "Look up" after answering: opens the dictionary over the lesson, with the answer already searched. */
import { useState } from 'react';
import { DictionarySheet } from '../features/dictionary/DictionaryView';
import { Search } from './icons';

export function LookUp({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 ${className}`}>
        <Search className="h-3.5 w-3.5" /> Look up
      </button>
      {open && <DictionarySheet query={text.trim()} onClose={() => setOpen(false)} />}
    </>
  );
}
