import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import hanzi from '../../content/data/hanzi.json';
import look from '../../content/lookalikes.json';

const chars = hanzi.chars as Record<string, unknown>;
const pairs = new Set(
  readFileSync(new URL('../../content/data/lookalike-candidates.tsv', import.meta.url), 'utf8')
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((l) => {
      const [, , a, b] = l.split('\t');
      return [a, b].sort().join('');
    }),
);

describe('look-alike groups', () => {
  it('are picked from the data-made candidates: every character is linked to the group by a candidate pair', () => {
    const bad: string[] = [];
    for (const g of look.groups) {
      const cs = [...g];
      const linked = new Set([cs[0]]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of cs) if (!linked.has(c) && [...linked].some((x) => pairs.has([c, x].sort().join('')))) (linked.add(c), (grew = true));
      }
      if (linked.size !== cs.length || cs.some((c) => !chars[c])) bad.push(g);
    }
    expect(bad).toEqual([]);
  });
  it('stay small and well chosen', () => {
    expect(look.groups.length).toBeLessThanOrEqual(80);
    expect(look.groups.every((g) => [...g].length >= 2 && [...g].length <= 6)).toBe(true);
    for (const pair of ['己已', '买卖', '人入', '大太', '大犬', '末未', '土士']) expect(look.groups.some((g) => [...pair].every((c) => g.includes(c)))).toBe(true);
  });
  it('character data covers the building blocks', () => {
    const ma = chars['妈'] as { parts: string[][] };
    expect(ma.parts.map((p) => p[0])).toEqual(['女', '马']);
    expect(ma.parts[1][3]).toBe('sound');
  });
});
