/**
 * Words that unlock the most songs (IDEAS #8): for every HSK word you don't
 * know yet, how many songs would move up a band (tough → stretch → comfortable)
 * if you learned just that word. Uses the catalogue's word counts only.
 */
import { bandOf, decodeWords, type Band, type Catalogue, type CatalogueSong } from './catalogue';

export interface UnlockWord {
  id: string;
  /** Songs that would move up at least one band. */
  songs: number;
  /** Of those, songs that would become comfortable. */
  comfortable: number;
}

const RANK: Record<Band, number> = { tough: 0, stretch: 1, comfortable: 2 };

export function unlockingWords(
  c: Catalogue,
  songs: CatalogueSong[],
  known: (id: string) => boolean,
  order: (id: string) => number = () => 0,
  limit = 5,
): UnlockWord[] {
  const out = new Map<string, UnlockWord>();
  for (const s of songs) {
    const ws = decodeWords(c, s);
    let ok = s.f;
    let total = s.f + s.o;
    for (const w of ws) {
      total += w.n;
      if (known(w.id)) ok += w.n;
    }
    if (!total) continue;
    const now = RANK[bandOf(ok / total)];
    if (now === RANK.comfortable) continue;
    for (const w of ws) {
      if (known(w.id)) continue;
      const after = bandOf((ok + w.n) / total);
      if (RANK[after] <= now) continue;
      const u = out.get(w.id) ?? { id: w.id, songs: 0, comfortable: 0 };
      u.songs++;
      if (after === 'comfortable') u.comfortable++;
      out.set(w.id, u);
    }
  }
  return [...out.values()].sort((a, b) => b.songs - a.songs || b.comfortable - a.comfortable || order(a.id) - order(b.id)).slice(0, limit);
}
