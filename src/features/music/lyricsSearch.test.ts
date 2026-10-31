import { afterEach, describe, expect, it, vi } from 'vitest';
import { lyricSearches, searchLyrics, searchText } from './lyrics';

const T2S = { 蘇: '苏', 綠: '绿' };
const names = [{ title: '你喔！（蘇打綠版）', artist: 'sodagreen' }];
const rec = { id: 7, trackName: '你喔', artistName: '苏打绿', duration: 250, instrumental: false, plainLyrics: null, syncedLyrics: '[00:01.00] 你喔\n[00:05.00] 你喔' };

afterEach(() => vi.unstubAllGlobals());

describe('Follow along lyrics search', () => {
  it('drops punctuation and the version note from what it searches for', () => {
    expect(searchText('你喔！')).toBe('你喔');
    const s = lyricSearches(names, T2S);
    expect(s[0]).toEqual({ track_name: '你喔', artist_name: 'sodagreen' });
    // Last resort: the title alone (the artist can be spelled 苏打绿 on LRCLIB).
    expect(s.at(-1)).toEqual({ track_name: '你喔' });
  });

  it('finds the song under another artist spelling by title and length', async () => {
    vi.stubGlobal('fetch', async (u: string) => new Response(JSON.stringify(new URL(u).searchParams.has('artist_name') || new URL(u).searchParams.has('q') ? [] : [rec]), { status: 200 }));
    expect((await searchLyrics(names, 251, T2S, { tries: 1 }))?.id).toBe(7);
  });

  it('carries on past a failing search, and only fails when every search failed', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => (n++ === 0 ? new Response('busy', { status: 500 }) : new Response(JSON.stringify([rec]), { status: 200 })));
    expect((await searchLyrics(names, 250, T2S, { tries: 1 }))?.id).toBe(7);
    vi.stubGlobal('fetch', async () => new Response('busy', { status: 503 }));
    await expect(searchLyrics(names, 250, T2S, { tries: 1 })).rejects.toThrow();
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 200 }));
    expect(await searchLyrics(names, 250, T2S, { tries: 1 })).toBeNull();
  });
});
