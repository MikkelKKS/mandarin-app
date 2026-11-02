import { describe, expect, it } from 'vitest';
import type { Catalogue, CatalogueSong } from './catalogue';
import { unlockingWords } from './unlock';

const song = (id: number, w: string, extra: Partial<CatalogueSong> = {}): CatalogueSong => ({ id, title: `s${id}`, artist: 'A', dur: 200, synced: true, scene: 'pop', w, o: 0, f: 0, d: 3, lv: [], ...extra });
const cat: Catalogue = {
  generated: '2026-11-02',
  words: ['wo', 'ai', 'ni', 'yueliang', 'sinian', 'xin'],
  songs: [
    song(1, '0:18,3:1,4:1'), // 90% stretch; yueliang or sinian → 95% comfortable
    song(2, '0:17,3:2,5:1'), // 85% stretch; yueliang → 95% comfortable, xin → 90% (still stretch)
    song(3, '0:16,3:4'), // 80% tough; yueliang → 100%
    song(4, '0:20'), // already comfortable
  ],
};
const known = (id: string) => id === 'wo';

describe('words that unlock songs', () => {
  it('counts songs each unknown word would move up a band', () => {
    const r = unlockingWords(cat, cat.songs, known);
    expect(r[0]).toEqual({ id: 'yueliang', songs: 3, comfortable: 3 });
    expect(r.find((u) => u.id === 'sinian')).toEqual({ id: 'sinian', songs: 1, comfortable: 1 });
    expect(r.find((u) => u.id === 'xin')).toBeUndefined();
  });
  it('breaks ties by learning order and respects the limit', () => {
    const order = (id: string) => (id === 'sinian' ? 0 : 1);
    expect(unlockingWords(cat, [cat.songs[0]], known, order, 1).map((u) => u.id)).toEqual(['sinian']);
  });
});
