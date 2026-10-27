import { useRef, useState } from 'react';
import promptText from '../../../content/practice-pack-prompt.md?raw';
import { downloadBlob } from '../../sync/backup';
import { go } from '../../lib/router';
import { validatePack } from './pack';
import { savePack } from './store';
import { exportWeakSpots } from './weakspots';

const btn = 'rounded-xl border-2 border-line px-4 py-2 font-medium';

export function PacksSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const fullPrompt = async () => `${promptText}\n\`\`\`json\n${JSON.stringify(await exportWeakSpots(), null, 1)}\n\`\`\`\n`;

  const copy = async () => {
    const t = await fullPrompt();
    try {
      await navigator.clipboard.writeText(t);
      setCopied('Copied! Paste it into a new chat at claude.ai.');
    } catch {
      downloadBlob(new Blob([t], { type: 'text/markdown' }), 'practice-pack-request.md');
      setCopied("Couldn't use the clipboard, so it was saved as a file. Open it and paste the contents into Claude.");
    }
  };

  const doImport = async (raw: string) => {
    setDone(null);
    const r = validatePack(raw);
    setErrors(r.errors);
    if (r.pack) {
      await savePack(r.pack);
      setText('');
      setDone(`Imported “${r.pack.title}”. It's at the top of the path.`);
    }
  };

  return (
    <div className="py-4">
      <p className="text-sm text-muted">Get practice made for your weak spots: copy your weak spots, paste them into Claude, then paste Claude's answer back here.</p>
      <ol className="mt-3 flex flex-col gap-4">
        <li>
          <p className="font-medium">1. Copy your weak spots + instructions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-xl bg-jade px-4 py-2 font-semibold text-jade-ink" onClick={copy}>
              Copy for Claude
            </button>
            <button
              className={btn}
              onClick={async () => downloadBlob(new Blob([JSON.stringify(await exportWeakSpots(), null, 1)], { type: 'application/json' }), `weak-spots-${new Date().toISOString().slice(0, 10)}.json`)}
            >
              Export weak spots (JSON)
            </button>
          </div>
          {copied && <p className="mt-2 text-sm">{copied}</p>}
        </li>
        <li>
          <p className="font-medium">2. Paste it into a new chat at claude.ai</p>
          <p className="text-sm text-muted">Claude replies with a block of JSON. Copy all of it.</p>
        </li>
        <li>
          <p className="font-medium">3. Paste Claude's reply here</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder='{ "format": "mandarin-practice-pack/1", … }'
            aria-label="Practice pack JSON"
            className="mt-2 w-full rounded-xl border-2 border-line bg-surface p-3 font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-xl bg-jade px-4 py-2 font-semibold text-jade-ink disabled:opacity-50" disabled={!text.trim()} onClick={() => doImport(text)}>
              Import practice pack
            </button>
            <button className={btn} onClick={() => file.current?.click()}>
              From a file…
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) await doImport(await f.text());
              }}
            />
          </div>
        </li>
      </ol>
      {errors.length > 0 && (
        <div className="mt-3 rounded-xl bg-cinnabar-soft p-3 text-sm" role="alert">
          <p className="font-semibold">The pack couldn't be imported:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="mt-2">Tip: paste these errors back to Claude and ask it to fix the pack.</p>
        </div>
      )}
      {done && (
        <p className="mt-3 rounded-xl bg-jade-soft p-3 text-sm">
          {done}{' '}
          <button className="underline" onClick={() => go('conversations')}>
            Go to the path
          </button>
        </p>
      )}
    </div>
  );
}
