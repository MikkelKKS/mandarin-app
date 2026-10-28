/** Assembles generator input for Conversations lessons. */
import { exchanges, nodes, sentences, sounds, units, words, getUnit } from '../../content';
import type { Exchange, Sentence, Word } from '../../content/schema';
import { pickVoice } from '../../lib/audio';
import { generateLesson, type GenInput } from './generator';
import { currentSettings, speakingActive } from '../../lib/settings';
import type { Exercise } from './types';

function poolUpTo(unitOrder: number): { poolWords: Word[]; poolSentences: Sentence[] } {
  const us = units.filter((u) => u.order <= unitOrder);
  const ids = new Set(us.map((u) => u.id));
  return {
    poolWords: [...words.values()].filter((w) => ids.has(w.unit)),
    poolSentences: [...sentences.values()].filter((s) => ids.has(s.unit)),
  };
}

function baseInput(unitOrder: number, quiet: boolean): Omit<GenInput, 'words' | 'sentences' | 'exchanges' | 'introduce' | 'length'> {
  return {
    speaking: speakingActive(),
    toneFocus: currentSettings().toneFocus,
    ...poolUpTo(unitOrder),
    allSentences: sentences,
    minimalPairs: sounds.minimalPairs,
    quiet,
    voice: pickVoice,
  };
}

const get = <T,>(m: Map<string, T>, ids: string[]) => ids.map((id) => m.get(id)).filter((x): x is T => !!x);

export function buildNodeLesson(nodeId: string, opts: { introduce: string[]; quiet: boolean; length?: number }): Exercise[] {
  const node = nodes.get(nodeId)!;
  const unit = getUnit(node.unit)!;
  return generateLesson({
    ...baseInput(unit.order, opts.quiet),
    words: get(words, node.words),
    sentences: get(sentences, node.sentences),
    exchanges: get(exchanges, node.exchanges) as Exchange[],
    introduce: opts.introduce,
    length: opts.length ?? 12,
  });
}
