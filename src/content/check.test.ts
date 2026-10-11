import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContent, checkPinyinAgainstHanzi } from './check';

const root = join(__dirname, '../..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const unitFiles = readdirSync(join(root, 'content/units')).filter((f) => f.endsWith('.json'));
const units = () => unitFiles.map((f) => ({ file: f, data: read(`content/units/${f}`) }));

describe('content validation', () => {
  it('the shipped curriculum has no errors (audio aside)', () => {
    const r = checkContent(read('content/course.json'), units(), read('content/sounds.json'), () => true);
    expect(r.errors).toEqual([]);
  });

  it('catches unknown words, bad tokenisation and wrong pinyin', () => {
    const us = units();
    const u = us[0].data;
    u.sentences.push({ id: 's-broken', hanzi: '你好吗？', pinyin: 'Nǐ hǎo ma?', english: 'x', words: ['w-ni', 'w-nope'] });
    u.sentences.push({ id: 's-broken2', hanzi: '我很好。', pinyin: 'Wǒ hěn hǎo.', english: 'x', words: ['w-wo', 'w-hao'] });
    u.words.push({ id: 'w-badtone', hanzi: '好', pinyin: 'hāo', english: ['x'], hsk: 1, pos: 'adjective' });
    const r = checkContent(read('content/course.json'), us, read('content/sounds.json'), () => false);
    const all = r.errors.join('\n');
    expect(all).toContain('unknown word "w-nope"');
    expect(all).toContain('s-broken2: word tokens spell');
    expect(all).toContain('w-badtone');
    expect(all).toContain('audio file(s) missing');
  });

  it('checks pinyin against characters with sandhi and neutral tones allowed', () => {
    expect(checkPinyinAgainstHanzi('不是', 'bú shì')).toBeNull();
    expect(checkPinyinAgainstHanzi('一个', 'yí ge')).toBeNull();
    expect(checkPinyinAgainstHanzi('谢谢', 'xièxie')).toBeNull();
    expect(checkPinyinAgainstHanzi('你好', 'nǐ hǎ')).not.toBeNull();
    expect(checkPinyinAgainstHanzi('你好', 'nǐ hāo')).not.toBeNull();
  });
});
