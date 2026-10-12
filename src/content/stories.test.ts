import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkStory, segmentWithVocab } from './stories';

const root = join(__dirname, '../..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const units = readdirSync(join(root, 'content/units'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(`content/units/${f}`));

describe('stories', () => {
  it('only use words taught by the unit they follow', () => {
    for (const f of readdirSync(join(root, 'content/stories')).filter((x) => x.endsWith('.json'))) {
      expect(checkStory(f, read(`content/stories/${f}`), units)).toEqual([]);
    }
  });
  it('splits text into known words and flags unknown characters', () => {
    const r = segmentWithVocab('我喜欢跑步！龙', new Set(['我', '喜欢', '跑步']));
    expect(r.tokens.map((t) => t.text)).toEqual(['我', '喜欢', '跑步', '！', '龙']);
    expect(r.unknown).toEqual(['龙']);
  });
});
