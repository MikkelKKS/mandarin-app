/**
 * Comparing meanings. CC-CEDICT glosses are lists like "to obtain; to get"; two
 * words "mean the same" here when any single term overlaps (to get = to get).
 * Used to keep near-synonyms out of multiple choice, and to accept another
 * word with the same meaning when typing pinyin from English.
 */

const DROP = /^(to|a|an|the|be|one's|sb|sth|of|used|also|esp\.?|lit\.?|fig\.?)\s+/i;

/** Normalised meaning terms: "to obtain; to get (sth)" → {"obtain", "get"}. */
export function glossTerms(gloss: string[]): Set<string> {
  const out = new Set<string>();
  for (const g of gloss)
    for (let part of g.split(/[;,/]/)) {
      part = part
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .toLowerCase()
        .replace(/[^a-z' -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      for (let i = 0; i < 3; i++) part = part.replace(DROP, '');
      if (part.length >= 2) out.add(part);
    }
  return out;
}

/** Do two words share any meaning term? */
export function sharesMeaning(a: string[], b: string[]): boolean {
  const ta = glossTerms(a);
  for (const t of glossTerms(b)) if (ta.has(t)) return true;
  return false;
}

/** Pinyin compared exactly, tones included (spaces, case and apostrophes ignored). */
export const samePinyin = (a: string, b: string) => a.toLowerCase().replace(/[\s'’-]/g, '') === b.toLowerCase().replace(/[\s'’-]/g, '');
