import { expect, test, type Page } from '@playwright/test';

// The song catalogue, Spotify, LRCLIB and the dictionary are all mocked: the test never leaves the machine.
test.use({ serviceWorkers: 'block' });
const DICT = [
  ['我', 'wǒ', 'wo', 'I / me', '1'],
  ['你', 'nǐ', 'ni', 'you', '1'],
  ['爱', 'ài', 'ai', 'to love', '1'],
  ['今天', 'jīn tiān', 'jintian', 'today', '1'],
  ['北京', 'Běi jīng', 'beijing', 'Beijing', '1'],
  ['月亮', 'yuè liang', 'yueliang', 'moon', '3'],
  ['思念', 'sī niàn', 'sinian', 'to miss', '5'],
]
  .map((r) => r.join('\t'))
  .join('\n');

// Original practice lines, repeated to look like a song.
const LYRICS = Array.from({ length: 4 }, (_, i) => `[00:${String(10 + i * 8).padStart(2, '0')}.00] 我爱你 今天去北京\n[00:${String(14 + i * 8).padStart(2, '0')}.00] 月亮 思念 你`).join('\n');

/** Derived data only, like the real catalogue: HSK word ids with counts. */
const CATALOGUE = {
  generated: '2026-10-29',
  words: ['wo3-9mnpj', 'ai4-oqccu', 'ni3-l1kpx', 'yue4liang5-abfda', 'si1nian4-dc73q', 'jin1tian1-b55cn', 'bei3jing1-inre0'],
  songs: [
    { id: 101, title: '练习歌', artist: '练习乐队', dur: 200, synced: true, scene: 'pop', w: '0:8,1:4,2:8,3:4,4:4,5:4,6:4', o: 0, f: 0, d: 7, lv: [5, 0, 1, 0, 1, 0, 0] },
    { id: 102, title: '月亮歌', artist: '月亮', dur: 180, synced: false, scene: 'ballad', w: '3:10,4:10', o: 2, f: 0, d: 3, lv: [0, 0, 1, 0, 1, 0, 0] },
  ],
};

function track(id: string, name: string, artist: string, ms = 200000) {
  return { id, name, uri: `spotify:track:${id}`, duration_ms: ms, artists: [{ name: artist }], album: { images: [] }, external_urls: { spotify: `https://open.spotify.com/track/${id}` } };
}

async function mock(page: Page, opts: { lyricsFailures?: number } = {}) {
  const calls: string[] = [];
  let failures = opts.lyricsFailures ?? 0;
  await page.route('**/dict/cedict.tsv', (r) => r.fulfill({ body: DICT, contentType: 'text/plain' }));
  await page.route('**/dict/t2s.json', (r) => r.fulfill({ json: { 愛: '爱' } }));
  await page.route(/\/assets\/songs-[^/]+\.json$/, (r) => r.fulfill({ json: CATALOGUE }));
  await page.route('https://api.spotify.com/v1/**', async (r) => {
    const url = new URL(r.request().url());
    calls.push(`${r.request().method()} ${url.pathname}${url.search}`);
    if (url.pathname === '/v1/search') {
      const q = url.searchParams.get('q') ?? '';
      // 练习歌 is on Spotify (a live version of another length, and the real one); 月亮歌 isn't.
      if (q.includes('练习歌')) return r.fulfill({ json: { tracks: { items: [track('live', '练习歌 (Live)', '练习乐队', 250000), track('sp101', '练习歌', '练习乐队', 201000)] } } });
      return r.fulfill({ json: { tracks: { items: [track('other', '别的歌', '别人', 180000)] } } });
    }
    if (url.pathname === '/v1/me/playlists') return r.fulfill({ json: { id: 'pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } } });
    if (url.pathname.startsWith('/v1/playlists/')) return r.fulfill({ status: 200, json: { snapshot_id: 'x' } });
    if (url.pathname === '/v1/me/player/currently-playing') return r.fulfill({ json: { item: track('sp101', '练习歌', '练习乐队', 201000), progress_ms: 15000, is_playing: true, currently_playing_type: 'track' } });
    return r.fulfill({ status: 404, json: { error: { message: 'not mocked' } } });
  });
  await page.route('https://lrclib.net/api/**', (r) => {
    const url = new URL(r.request().url());
    calls.push(`LRCLIB ${url.pathname}`);
    if (failures > 0) {
      failures--;
      return r.fulfill({ status: 503, body: 'busy' });
    }
    const m = /\/api\/get\/(\d+)$/.exec(url.pathname);
    if (m?.[1] === '101') return r.fulfill({ json: { id: 101, trackName: '练习歌', artistName: '练习乐队', duration: 200, instrumental: false, plainLyrics: null, syncedLyrics: LYRICS } });
    if (m?.[1] === '102') return r.fulfill({ json: { id: 102, trackName: '月亮歌', artistName: '月亮', duration: 180, instrumental: false, plainLyrics: '月亮 思念\n月亮 思念', syncedLyrics: null } });
    return r.fulfill({ status: 404, body: '' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('spotify:auth', JSON.stringify({ access: 'test', refresh: 'r', expiresAt: Date.now() + 3600e3, scope: 'user-read-private playlist-read-private playlist-modify-private playlist-modify-public user-read-currently-playing' }));
  });
  return calls;
}

test('music: songs are ranked at once, filters work, a playlist is saved from the top of the list', async ({ page }) => {
  const calls = await mock(page);
  await page.goto('./#/music');
  await expect(page.getByRole('heading', { name: 'Music' })).toBeVisible();
  // No searching step: the catalogue is ranked straight away.
  await expect(page.getByText('2 songs')).toBeVisible();
  await expect(page.getByText(/you know \d+%/).first()).toBeVisible();
  await page.getByRole('checkbox', { name: /timed lyrics/ }).check();
  await expect(page.getByText('1 songs')).toBeVisible();
  await expect(page.getByText('月亮歌')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /timed lyrics/ }).uncheck();
  await page.getByRole('button', { name: /Ballads/ }).click();
  await expect(page.getByText('练习歌')).toHaveCount(0);
  await page.getByRole('button', { name: /Ballads/ }).click();

  await page.getByRole('button', { name: /Save the top \d+ as a playlist/ }).click();
  await expect(page.getByText(/Open “学中文: songs at my level” in Spotify/)).toBeVisible();
  await expect(page.getByText(/1 weren't on Spotify/)).toBeVisible();
  expect(calls).toContain('POST /v1/me/playlists');
  expect(calls.some((c) => c.startsWith('PUT /v1/playlists/pl1/items'))).toBe(true);
});

test('a song: lyrics by id (retried after an error), found on Spotify by name and length, words to learn', async ({ page }) => {
  const calls = await mock(page, { lyricsFailures: 1 });
  await page.goto('./#/music/song/101');
  await expect(page.getByRole('heading', { name: 'Lyrics' })).toBeVisible();
  // The lyric lines (not the words-to-learn chips above them).
  await expect(page.locator('p.han > button').first()).toBeVisible({ timeout: 15_000 });
  expect(calls.filter((c) => c === 'LRCLIB /api/get/101').length).toBe(2);
  // The live version is 50 s longer: the real one is picked.
  await expect(page.getByRole('link', { name: 'Play in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/track/sp101');
  await page.getByRole('button', { name: /思念/ }).first().click();
  await expect(page.getByText('to miss')).toBeVisible();
  await page.getByRole('button', { name: 'Learn next' }).click();
  await expect(page.getByRole('button', { name: 'Learning next' })).toBeVisible();
});

test("a song that isn't on Spotify still shows its lyrics; a lyrics outage offers Try again", async ({ page }) => {
  await mock(page, { lyricsFailures: 4 });
  await page.goto('./#/music/song/102');
  await expect(page.getByText(/isn't on Spotify/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('p.han > button').first()).toBeVisible({ timeout: 15_000 });
});

test('follow along: the playing song is found in the catalogue, and the timing can be nudged', async ({ page }) => {
  const calls = await mock(page);
  await page.goto('./#/music/now');
  await expect(page.getByRole('heading', { name: 'Follow along' })).toBeVisible();
  await expect(page.getByText('练习歌')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Lyrics timing' })).toBeVisible({ timeout: 15_000 });
  expect(calls).toContain('LRCLIB /api/get/101');
  const offset = page.getByRole('group', { name: 'Lyrics timing' }).locator('span.tabular-nums');
  await page.getByRole('button', { name: 'Lyrics half a second later' }).click();
  await expect(offset).toHaveText('+0.5 s');
  // Remembered for this song on this device.
  await page.reload();
  await expect(offset).toHaveText('+0.5 s', { timeout: 15_000 });
});
