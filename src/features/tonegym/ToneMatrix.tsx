/**
 * Tone confusion matrix: rows are the tone that was right, columns the tone
 * you heard or typed. Each row adds up to 100%. Below it, the tone-pair mix-ups.
 */
import { pairConfusions, patternLabel, toneMatrix, TONE_WORD, type ToneLog } from './model';

const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];

export function ToneMatrix({ logs, caption }: { logs: ToneLog[]; caption?: string }) {
  const m = toneMatrix(logs);
  const total = m.flat().reduce((a, b) => a + b, 0);
  const pairs = pairConfusions(logs);
  if (!total)
    return <p className="rounded-2xl bg-sunk p-4 text-sm text-muted">The matrix fills in as you answer tone questions and type pinyin.</p>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-separate border-spacing-1 text-sm tabular-nums" aria-label="Tone confusion matrix">
          {caption && <caption className="mb-1 text-left text-xs text-muted">{caption}</caption>}
          <thead>
            <tr>
              <th className="w-20 text-left text-xs font-medium text-muted">Right ↓ / You →</th>
              {[1, 2, 3, 4, 5].map((g) => (
                <th key={g} scope="col" className={`font-semibold ${TONE_TEXT[g]}`}>
                  {g === 5 ? '0' : g}
                </th>
              ))}
              <th className="text-xs font-medium text-muted">n</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((e) => {
              const row = m[e];
              const n = row.reduce((a, b) => a + b, 0);
              return (
                <tr key={e}>
                  <th scope="row" className={`text-left font-semibold ${TONE_TEXT[e]}`}>
                    {TONE_WORD[e]}
                  </th>
                  {[1, 2, 3, 4, 5].map((g) => {
                    const share = n ? row[g] / n : 0;
                    const right = g === e;
                    // Shade by share of the row: jade on the diagonal, cinnabar for mix-ups.
                    const bg = !n || !row[g] ? 'transparent' : right ? `rgb(from var(--jade) r g b / ${0.12 + share * 0.5})` : `rgb(from var(--cinnabar) r g b / ${0.1 + share * 0.9})`;
                    return (
                      <td
                        key={g}
                        className="h-10 rounded-lg text-center"
                        style={{ background: bg }}
                        title={n ? `${TONE_WORD[e]} tone answered as ${TONE_WORD[g]}: ${row[g]} of ${n}` : undefined}
                      >
                        {n ? `${Math.round(share * 100)}%` : '·'}
                      </td>
                    );
                  })}
                  <td className="text-center text-xs text-muted">{n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pairs.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Tone pairs you mix up</p>
          <ul className="mt-1 flex flex-wrap gap-2 text-sm">
            {pairs.map((p) => (
              <li key={`${p.expected}>${p.given}`} className="rounded-xl bg-sunk px-3 py-1.5 tabular-nums">
                <span className="font-semibold">{patternLabel(p.expected)}</span> heard as <span className="font-semibold">{patternLabel(p.given)}</span>{' '}
                <span className="text-muted">×{p.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
