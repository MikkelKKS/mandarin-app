/** Assembles generator input for node lessons, test-outs and practice. */
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

export function buildNodeLesson(nodeId: string, opts: { firstTime: boolean; quiet: boolean; length?: number }): Exercise[] {
  const node = nodes.get(nodeId)!;
  const unit = getUnit(node.unit)!;
  return generateLesson({
    ...baseInput(unit.order, opts.quiet),
    words: get(words, node.words),
    sentences: get(sentences, node.sentences),
    exchanges: get(exchanges, node.exchanges) as Exchange[],
    introduce: opts.firstTime ? node.words : [],
    length: opts.length ?? 12,
  });
}

export function buildTestOut(unitId: string, quiet: boolean): Exercise[] {
  const unit = getUnit(unitId)!;
  return generateLesson({
    ...baseInput(unit.order, quiet),
    words: unit.words.map((w) => words.get(w.id)!),
    sentences: unit.sentences.map((s) => sentences.get(s.id)!),
    exchanges: unit.exchanges,
    introduce: [],
    length: 15,
  });
}

/** Lesson from an imported practice pack. */
export function buildPackLesson(pack: import('../packs/pack').Pack, quiet: boolean): Exercise[] {
  const tokenIds = new Set([...pack.words.map((w) => w.id), ...pack.sentences.flatMap((s) => s.words)]);
  const packWords = get(words, [...tokenIds]);
  const maxOrder = Math.max(0, ...packWords.map((w) => getUnit(w.unit)?.order ?? 0));
  const base = baseInput(maxOrder, quiet);
  return generateLesson({
    ...base,
    poolWords: [...base.poolWords, ...packWords.filter((w) => !base.poolWords.includes(w))],
    poolSentences: [...base.poolSentences, ...get(sentences, pack.sentences.map((s) => s.id))],
    words: packWords,
    sentences: get(sentences, pack.sentences.map((s) => s.id)),
    exchanges: pack.exchanges,
    introduce: pack.words.map((w) => w.id),
    length: 14,
  });
}

/** Practice from specific items (due reviews and recent mistakes). */
export function buildPractice(itemIds: string[], quiet: boolean, length = 12): Exercise[] {
  const ws = get(words, itemIds);
  const ss = get(sentences, itemIds);
  const maxOrder = Math.max(0, ...[...ws, ...ss].map((x) => getUnit(x.unit)?.order ?? 0));
  // Include exchanges whose reply/prompt is among the practised sentences.
  const sset = new Set(ss.map((s) => s.id));
  const xs = [...exchanges.values()].filter((x) => sset.has(x.prompt) || sset.has(x.reply));
  return generateLesson({
    ...baseInput(maxOrder, quiet),
    words: ws,
    sentences: ss,
    exchanges: xs,
    introduce: [],
    length,
  });
}
