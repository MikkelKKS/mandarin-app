import { describe, expect, it, vi } from 'vitest';
import { parseDict } from '../dictionary/dict';
import { bandOf, rankSongs, scoreSong, type Catalogue, type CatalogueSong } from './catalogue';
import { cleanTitle, HttpError, parseLrc, pickLrcMatch, pickSpotifyMatch, sameName, searchVariants, toSimplified, withRetry, type LrcRecord } from './match';
import { isChineseLyrics, tokenize } from './score';

const t2s = { 愛: '爱', 離: '离', 晴: '晴', 傑: '杰', 倫: '伦', 週: '周' };

describe('song catalogue ranking', () => {
  const song = (id: number, w: string, extra: Partial<CatalogueSong> = {}): CatalogueSong => ({ id, title: `s${id}`, artist: 'A', dur: 200, synced: true, scene: 'pop', w, o: 0, f: 0, d: 3, lv: [], ...extra });
  const cat: Catalogue = {
    generated: '2026-10-29',
    words: ['wo', 'ai', 'ni', 'yueliang', 'sinian'],
    songs: [
      song(1, '0:10,1:5,2:5'), // all known
      song(2, '0:10,1:5,2:4,3:1', { scene: 'ballad' }), // 19 of 20 known: 95% → comfortable
      song(3, '0:8,3:1,4:1', { synced: false }), // 8 of 10 → tough
      song(4, '0:9,1:9', { o: 2, f: 0, artist: 'B' }), // 18 of 20 → 90% stretch
      song(5, '0:5', { f: 5, artist: 'B' }), // fillers count as known
    ],
  };
  const known = (id: string) => ['wo', 'ai', 'ni'].includes(id);

  it('scores by the words you know, each time they are sung; fillers count as known, other words as unknown', () => {
    expect(scoreSong(cat, cat.songs[1], known).knownShare).toBeCloseTo(0.95);
    expect(scoreSong(cat, cat.songs[3], known).knownShare).toBeCloseTo(0.9);
    expect(scoreSong(cat, cat.songs[4], known).knownShare).toBe(1);
    expect(scoreSong(cat, cat.songs[2], known).unknown).toEqual(['yueliang', 'sinian']);
  });
  it('bands: comfortable 95%+, stretch 85–95%, tough below', () => {
    expect([bandOf(0.96), bandOf(0.95), bandOf(0.9), bandOf(0.85), bandOf(0.84)]).toEqual(['comfortable', 'comfortable', 'stretch', 'stretch', 'tough']);
  });
  it('filters by scene, band and timed lyrics, easiest first', () => {
    const all = rankSongs(cat, { scenes: [], band: 'any', syncedOnly: false }, known);
    expect(all[0].score.knownShare).toBe(1);
    expect(all.at(-1)!.song.id).toBe(3);
    expect(rankSongs(cat, { scenes: ['ballad'], band: 'any', syncedOnly: false }, known).map((r) => r.song.id)).toEqual([2]);
    expect(rankSongs(cat, { scenes: [], band: 'stretch', syncedOnly: false }, known).map((r) => r.song.id)).toEqual([4]);
    expect(rankSongs(cat, { scenes: [], band: 'any', syncedOnly: true }, known).some((r) => r.song.id === 3)).toBe(false);
  });
  it('at most three songs per artist before the rest', () => {
    const many: Catalogue = { ...cat, songs: Array.from({ length: 5 }, (_, i) => song(10 + i, '0:10')).concat([song(20, '0:9,3:1', { artist: 'Z' })]) };
    const ids = rankSongs(many, { scenes: [], band: 'any', syncedOnly: false }, known).map((r) => r.song.id);
    expect(ids.indexOf(20)).toBe(3);
  });
});

describe('finding a song on Spotify', () => {
  const song = { duration: 269, names: [{ title: '晴天', artist: '周杰伦' }, { title: '晴天', artist: 'Jay Chou' }] };
  const t = (id: string, name: string, artists: string[], s: number) => ({ id, name, artists, durationMs: s * 1000 });
  it('same title within 5 seconds, closest wins; another version of a different length is not it', () => {
    const pick = pickSpotifyMatch([t('live', '晴天 (Live)', ['周杰倫'], 300), t('far', '晴天', ['周杰倫'], 262), t('ok', '晴天', ['Jay Chou'], 270), t('cover', '晴天', ['Someone'], 268)], song, t2s);
    expect(pick?.id).toBe('ok');
  });
  it('traditional characters and romanised artist names match', () => {
    expect(sameName('周杰倫', '周杰伦', t2s)).toBe(true);
    expect(pickSpotifyMatch([t('x', '晴天', ['周杰倫'], 266)], song, t2s)?.id).toBe('x');
  });
  it('a title in another script only counts with the same artist and nearly the same length', () => {
    expect(pickSpotifyMatch([t('r', 'Qing Tian', ['Jay Chou'], 268)], song, t2s)?.id).toBe('r');
    expect(pickSpotifyMatch([t('r', 'Qing Tian', ['Jay Chou'], 265)], song, t2s)).toBeNull();
    expect(pickSpotifyMatch([t('n', 'Other song', ['Someone'], 269)], song, t2s)).toBeNull();
  });
  it('search spellings: cleaned and simplified, without repeats', () => {
    expect(searchVariants([{ title: '離開 (Live)', artist: '某人' }, { title: '離開', artist: '某人' }], t2s)).toEqual([
      { title: '離開', artist: '某人' },
      { title: '离開', artist: '某人' },
    ]);
  });
});

describe('lyrics for a playing song (Follow along)', () => {
  const rec = (id: number, trackName: string, duration: number, synced: boolean): LrcRecord => ({ id, trackName, artistName: '周杰伦', duration, instrumental: false, plainLyrics: 'x', syncedLyrics: synced ? '[00:01.00] x' : null });
  it('same title within 8 seconds, timed lyrics preferred', () => {
    const best = pickLrcMatch([rec(1, '晴天', 270, false), rec(2, '晴天', 276, true), rec(3, '晴天', 290, true)], { duration: 269, names: [{ title: '晴天', artist: '周杰伦' }] }, t2s);
    expect(best?.id).toBe(2);
  });
});

describe('retrying the lyrics service', () => {
  const sleep = () => Promise.resolve();
  it('retries network errors, rate limits and server errors, then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new HttpError(429, 'slow down')).mockRejectedValueOnce(new HttpError(503, 'busy')).mockResolvedValue('ok');
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(4);
  });
  it('gives up after the last try, and does not retry other client errors', async () => {
    const fail = vi.fn().mockRejectedValue(new HttpError(500, 'down'));
    await expect(withRetry(fail, { tries: 3, sleep })).rejects.toThrow('down');
    expect(fail).toHaveBeenCalledTimes(3);
    const bad = vi.fn().mockRejectedValue(new HttpError(400, 'bad request'));
    await expect(withRetry(bad, { sleep })).rejects.toThrow('bad request');
    expect(bad).toHaveBeenCalledTimes(1);
  });
  it('waits longer each time', async () => {
    const waits: number[] = [];
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(502, 'x')).mockRejectedValueOnce(new HttpError(502, 'x')).mockResolvedValue(1);
    await withRetry(fn, { baseMs: 100, sleep: async (ms) => void waits.push(ms) });
    expect(waits[1]).toBeGreaterThan(waits[0]);
  });
});

describe('lyrics helpers', () => {
  const dict = parseDict(
    [
      ['我', 'wǒ', 'wo', 'I', '1'],
      ['爱', 'ài', 'ai', 'love', '1'],
      ['你', 'nǐ', 'ni', 'you', '1'],
      ['月亮', 'yuè liang', 'yueliang', 'moon', '3'],
    ]
      .map((r) => r.join('\t'))
      .join('\n'),
  );
  it('colours words by what you know, reading traditional characters too', () => {
    const toks = tokenize('我愛你 月亮', dict, t2s, { known: new Set(['我', '你']), learning: new Set(['爱']), level: 2 }).filter((x) => x.status !== 'other');
    expect(toks.map((x) => x.status)).toEqual(['known', 'learning', 'known', 'hard']);
    expect(toSimplified('我愛你', t2s)).toBe('我爱你');
  });
  it('parses timed lyrics and cleans titles', () => {
    expect(parseLrc('[00:12.50] 第一句\n[01:02.00][01:30.00]副歌')).toEqual([
      { t: 12500, text: '第一句' },
      { t: 62000, text: '副歌' },
      { t: 90000, text: '副歌' },
    ]);
    expect(cleanTitle('晴天 (Live)')).toBe('晴天');
    expect(cleanTitle('Song - Remastered 2011')).toBe('Song');
  });
  it('spots English lyrics', () => {
    expect(isChineseLyrics(['I love you so much, baby', '我爱你'])).toBe(false);
  });
});
