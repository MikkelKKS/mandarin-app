/**
 * Does a typed English meaning match a word's glosses? Generous on purpose:
 * ignores case, punctuation, "to"/"a"/"the", and anything in brackets; a
 * gloss part or most of its words is enough. Used only as a hint for the
 * self-grade in listening reviews, never to fail an answer on its own.
 */
const STOP = new Set(['to', 'a', 'an', 'the', 'be', 'of', 'sb', 'sth', 'one', "one's", 'someone', 'something']);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export function meaningMatches(typed: string, glosses: string[]): boolean {
  const t = words(typed);
  if (!t.length) return false;
  const parts = glosses.flatMap((g) => g.split(/[;,/]/)).map(words).filter((p) => p.length);
  return parts.some((p) => {
    if (p.join(' ') === t.join(' ')) return true;
    const hit = t.filter((w) => p.some((x) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length;
    return hit >= Math.max(1, Math.ceil(p.length / 2)) && hit >= Math.ceil(t.length / 2);
  });
}
