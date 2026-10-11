/** Builds the "weak spots" summary that the owner pastes into Claude. */
import { grammar, nodes, sentences, units, words } from '../../content';
import { db, type ReviewItemRow, type ReviewLogRow } from '../../db/db';
import { computeStates, unlockedItemIds } from '../../lib/progress';
import { nodeOrder } from '../../content';

export interface WeakSpots {
  format: 'mandarin-weak-spots/1';
  exportedAt: string;
  level: { unitsReached: string[]; wordsKnown: number };
  weakWords: Array<{ id: string; hanzi: string; pinyin: string; english: string; misses: number }>;
  confusedTones: Array<{ expected: string; heardAs: string; times: number }>;
  hardGrammar: Array<{ title: string; errorRate: number; answers: number }>;
  missedSentences: Array<{ id: string; hanzi: string; pinyin: string; english: string }>;
  knownVocabulary: Array<{ id: string; hanzi: string; pinyin: string; english: string }>;
}

/** Pure core, testable without a database. */
export function buildWeakSpots(items: ReviewItemRow[], logs: ReviewLogRow[], unlocked: string[], now = Date.now()): WeakSpots {
  const since = now - 30 * 864e5;
  const recent = logs.filter((l) => l.at >= since);
  const misses = new Map<string, number>();
  for (const l of recent) if (l.verdict === 'wrong') misses.set(l.itemId, (misses.get(l.itemId) ?? 0) + 1);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const score = (id: string) => (misses.get(id) ?? 0) * 2 + (itemById.get(id)?.lapses ?? 0) + (itemById.get(id) && itemById.get(id)!.stability < 2 ? 1 : 0);

  const weakWords = [...words.values()]
    .filter((w) => score(w.id) > 0)
    .sort((a, b) => score(b.id) - score(a.id))
    .slice(0, 15)
    .map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, english: w.english[0], misses: misses.get(w.id) ?? 0 }));

  const tonePairs = new Map<string, number>();
  for (const l of recent) {
    if (!l.tones || l.tones.expected === l.tones.given) continue;
    const k = `${l.tones.expected}|${l.tones.given}`;
    tonePairs.set(k, (tonePairs.get(k) ?? 0) + 1);
  }
  const confusedTones = [...tonePairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, times]) => {
      const [expected, heardAs] = k.split('|');
      return { expected: `tones ${expected}`, heardAs: `tones ${heardAs}`, times };
    });

  // Grammar: error rate on sentences of nodes that teach each note.
  const stats = new Map<string, { wrong: number; total: number }>();
  const sentenceGrammar = new Map<string, string[]>();
  for (const n of nodes.values()) for (const s of n.sentences) sentenceGrammar.set(s, [...(sentenceGrammar.get(s) ?? []), ...n.grammar]);
  for (const l of recent) {
    for (const g of sentenceGrammar.get(l.itemId) ?? []) {
      const st = stats.get(g) ?? { wrong: 0, total: 0 };
      st.total++;
      if (l.verdict === 'wrong') st.wrong++;
      stats.set(g, st);
    }
  }
  const hardGrammar = [...stats.entries()]
    .filter(([, s]) => s.total >= 3 && s.wrong > 0)
    .map(([g, s]) => ({ title: grammar.get(g)?.title ?? g, errorRate: Math.round((s.wrong / s.total) * 100) / 100, answers: s.total }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  const lastMiss = new Map<string, number>();
  for (const l of recent) if (l.verdict === 'wrong' && sentences.has(l.itemId)) lastMiss.set(l.itemId, Math.max(lastMiss.get(l.itemId) ?? 0, l.at));
  const missedSentences = [...lastMiss.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => {
      const s = sentences.get(id)!;
      return { id, hanzi: s.hanzi, pinyin: s.pinyin, english: s.english };
    });

  const known = unlocked.filter((id) => words.has(id)).map((id) => words.get(id)!);
  const reached = units.filter((u) => u.words.some((w) => unlocked.includes(w.id))).map((u) => u.title);
  return {
    format: 'mandarin-weak-spots/1',
    exportedAt: new Date(now).toISOString(),
    level: { unitsReached: reached, wordsKnown: known.length },
    weakWords,
    confusedTones,
    hardGrammar,
    missedSentences,
    knownVocabulary: known.map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, english: w.english[0] })),
  };
}

export async function exportWeakSpots(): Promise<WeakSpots> {
  const [items, logs, progress] = await Promise.all([db.reviewItems.toArray(), db.reviewLogs.toArray(), db.progress.toArray()]);
  const states = computeStates(nodeOrder, new Map(progress.map((p) => [p.id, p])));
  return buildWeakSpots(items, logs, unlockedItemIds(states));
}
