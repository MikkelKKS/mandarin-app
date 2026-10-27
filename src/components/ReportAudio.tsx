/** Small "this recording sounds wrong" button; the item gets re-recorded. */
import { useState } from 'react';
import { reportAudio } from '../lib/audioReports';

export function ReportAudio({ id, hanzi, pinyin, className = '' }: { id: string; hanzi: string; pinyin?: string; className?: string }) {
  const [done, setDone] = useState(false);
  if (done) return <span className={`text-xs opacity-80 ${className}`}>Reported. It will be re-recorded.</span>;
  return (
    <button
      type="button"
      onClick={() => {
        void reportAudio(id, hanzi, pinyin);
        setDone(true);
      }}
      className={`text-xs underline underline-offset-2 opacity-70 hover:opacity-100 ${className}`}
    >
      Report bad audio
    </button>
  );
}
