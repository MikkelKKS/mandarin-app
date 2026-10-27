/**
 * Review cards per skill (listening → meaning, listening → pinyin,
 * meaning → pinyin, speaking) and today's queue.
 */
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import { cardState, FACET_LABEL, FACETS, parseCardId, todaysQueue, type Facet, type Queue } from '../../lib/review';
import { useSettings } from '../../lib/settings';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';

export function ReviewCards() {
  const settings = useSettings();
  const vocab = useVocab();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const [queue, setQueue] = useState<Queue | null>(null);

  useEffect(() => {
    if (!vocab || !cards) return;
    void todaysQueue(
      vocab.map((w) => w.id),
      { newPerDay: settings.newPerDay, reviewsPerDay: settings.reviewsPerDay, mic: settings.speaking },
    ).then(setQueue);
  }, [vocab, cards, settings.newPerDay, settings.reviewsPerDay, settings.speaking]);

  const rows = useMemo(() => {
    const now = Date.now();
    const out = new Map<Facet, { total: number; due: number; mature: number }>(FACETS.map((f) => [f, { total: 0, due: 0, mature: 0 }]));
    for (const c of cards ?? []) {
      const p = parseCardId(c.id);
      if (!p) continue;
      const r = out.get(p.facet)!;
      r.total++;
      if (c.state !== 0 && c.due <= now) r.due++;
      if (cardState(c) === 'mature') r.mature++;
    }
    return out;
  }, [cards]);

  if (!cards) return null;
  const byId = new Map((vocab ?? []).map((w) => [w.id, w]));
  const next = (queue?.newWords ?? []).slice(0, 6).map((id) => byId.get(id)).filter(Boolean);

  return (
    <section className="mt-8" aria-label="Review cards">
      <h2 className="text-lg font-semibold">Review cards</h2>
      <p className="text-sm text-muted">
        Every word has a card for each skill, so a word you understand but can't type yet comes back for typing on its own.
      </p>
      {queue && (
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <p className="font-semibold">
            Today: {queue.reviews.length} {queue.reviews.length === 1 ? 'review' : 'reviews'} due, {queue.newWords.length} new{' '}
            {queue.newWords.length === 1 ? 'word' : 'words'}
          </p>
          {queue.overCap > 0 && <p className="text-sm text-muted">{queue.overCap} more wait for tomorrow (daily limit in Settings).</p>}
          {next.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Next new words: <span className="text-ink">{next.map((w) => (settings.showHanzi ? w!.hanzi : w!.pinyin)).join(settings.showHanzi ? '、' : ', ')}</span>
            </p>
          )}
        </div>
      )}
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1.5 font-medium">Skill</th>
            <th className="py-1.5 text-right font-medium">Cards</th>
            <th className="py-1.5 text-right font-medium">Due</th>
            <th className="py-1.5 text-right font-medium">Mature</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {FACETS.filter((f) => f !== 'sp' || settings.speaking || rows.get(f)!.total > 0).map((f) => {
            const r = rows.get(f)!;
            return (
              <tr key={f} className="border-t border-line">
                <td className="py-2">{FACET_LABEL[f]}</td>
                <td className="py-2 text-right">{r.total}</td>
                <td className="py-2 text-right">{r.due}</td>
                <td className="py-2 text-right">{r.mature}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Mature: next review 21 days or more away. Retention target {Math.round(settings.retention * 100)}%.</p>
    </section>
  );
}
