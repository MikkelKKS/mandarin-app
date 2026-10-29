/** Everything the Reading track needs on screen: the word list, the character data and the reading index (lazy, cached). */
import { useEffect, useState } from 'react';
import { buildReadIndex, loadHanzi, type HanziData, type ReadIndex, type ReadItem } from '../../lib/reading';
import { loadVocabData, meaningOf, type VocabData } from '../../lib/vocabData';

export interface ReadData {
  vocab: VocabData;
  chars: HanziData;
  groups: string[];
  index: ReadIndex;
}

let cache: Promise<ReadData> | null = null;
export function loadReadData(): Promise<ReadData> {
  cache ??= Promise.all([loadVocabData(), loadHanzi()]).then(([vocab, h]) => ({
    vocab,
    chars: h.chars,
    groups: h.groups,
    index: buildReadIndex(vocab.words, h.chars, meaningOf),
  }));
  return cache;
}

export function useReadData(): ReadData | null {
  const [d, setD] = useState<ReadData | null>(null);
  useEffect(() => {
    let live = true;
    void loadReadData().then((x) => live && setD(x));
    return () => {
      live = false;
    };
  }, []);
  return d;
}

/** Known (or started) words that contain a character, most common first. */
export function wordsWith(d: ReadData, item: ReadItem, known: (wordId: string) => boolean, n = 2): string[] {
  if (item.kind !== 'char') return [];
  const ids = d.index.wordsWithChar.get(item.hanzi) ?? [];
  const others = ids.filter((id) => id !== item.word && [...(d.vocab.byId.get(id)?.hanzi ?? '')].length > 1);
  const good = others.filter(known);
  return [...good, ...others.filter((id) => !good.includes(id))].slice(0, n);
}
