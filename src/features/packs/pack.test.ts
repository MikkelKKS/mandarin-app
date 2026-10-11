import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatePack } from './pack';
import { buildWeakSpots } from './weakspots';

const prompt = readFileSync(join(__dirname, '../../../content/practice-pack-prompt.md'), 'utf8');
const example = prompt.match(/```json\n([\s\S]*?)```/)![1];

describe('practice packs', () => {
  it('the example in the prompt file is a valid pack', () => {
    const r = validatePack(example);
    expect(r.errors).toEqual([]);
    expect(r.pack?.sentences.length).toBe(4);
  });

  it('accepts a pack wrapped in a code block with chatter around it', () => {
    expect(validatePack(`Here you go!\n\n\`\`\`json\n${example}\n\`\`\`\nEnjoy`).errors).toEqual([]);
  });

  it('gives specific errors', () => {
    const bad = JSON.parse(example);
    bad.sentences[0].words = ['w-wo', 'w-nope'];
    bad.sentences[1].hanzi = '你要喝茶吗？';
    bad.sentences[2].id = 'sentence-3';
    const errs = validatePack(JSON.stringify(bad)).errors.join('\n');
    expect(errs).toContain('must start with "p-"');
    const bad2 = JSON.parse(example);
    bad2.sentences[0].words = ['w-wo', 'w-nope'];
    bad2.sentences[1].hanzi = '你要喝茶吗？';
    const errs2 = validatePack(JSON.stringify(bad2)).errors.join('\n');
    expect(errs2).toContain('unknown word id "w-nope"');
    expect(errs2).toContain('spell');
    expect(validatePack('not json').errors[0]).toContain("isn't valid JSON");
  });

  it('summarises weak spots from review logs', () => {
    const now = Date.now();
    const logs = [
      { id: '1', itemId: 'w-hao', exercise: 'dictation', verdict: 'wrong' as const, at: now - 1000, updatedAt: now },
      { id: '2', itemId: 'w-hao', exercise: 'tone-id', verdict: 'wrong' as const, at: now - 900, tones: { expected: '3', given: '2' }, updatedAt: now },
      { id: '3', itemId: 's-nihaoma', exercise: 'listen-sentence', verdict: 'wrong' as const, at: now - 800, updatedAt: now },
    ];
    const w = buildWeakSpots([], logs, ['w-ni', 'w-hao', 's-nihaoma'], now);
    expect(w.weakWords[0].id).toBe('w-hao');
    expect(w.confusedTones[0]).toEqual({ expected: 'tones 3', heardAs: 'tones 2', times: 1 });
    expect(w.missedSentences[0].id).toBe('s-nihaoma');
    expect(w.knownVocabulary.map((k) => k.id)).toEqual(['w-ni', 'w-hao']);
  });
});
