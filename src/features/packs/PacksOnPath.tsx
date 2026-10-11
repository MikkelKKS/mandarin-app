import { useState } from 'react';
import { go } from '../../lib/router';
import { deletePack, usePacks } from './store';

/** "Custom practice" nodes shown at the top of the path. */
export function PacksOnPath() {
  const packs = usePacks();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!packs.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-muted">Custom practice</h2>
      <ul className="flex flex-col gap-3">
        {packs.map((p) => (
          <li key={p.id} className="rounded-2xl border-2 border-gold/50 bg-surface p-4">
            <p className="font-semibold">{p.title}</p>
            {p.pack.focus && <p className="text-sm text-muted">{p.pack.focus}</p>}
            <p className="mt-1 text-xs text-muted">
              {p.pack.sentences.length} sentences · {p.pack.words.length} new words · imported {new Date(p.importedAt).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => go(`pack/${p.id}`)} className="rounded-xl bg-jade px-4 py-2 font-semibold text-jade-ink">
                Practise
              </button>
              {p.pack.dialogue && (
                <button onClick={() => go(`pack/${p.id}/story`)} className="rounded-xl border-2 border-line px-4 py-2 font-medium">
                  Story
                </button>
              )}
              {confirm === p.id ? (
                <button onClick={() => deletePack(p.id)} className="rounded-xl bg-cinnabar-soft px-4 py-2 font-medium text-cinnabar">
                  Tap again to remove
                </button>
              ) : (
                <button onClick={() => setConfirm(p.id)} className="ml-auto rounded-xl px-3 py-2 text-sm text-muted">
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
