import { expect, test, type Page } from '@playwright/test';

// Spotify, LRCLIB and the dictionary are all mocked: the test never leaves the machine.
test.use({ serviceWorkers: 'block' });
const DICT = [
  ['我', 'wǒ', 'wo', 'I / me', '1'],
  ['你', 'nǐ', 'ni', 'you', '1'],
  ['爱', 'ài', 'ai', 'to love', '1'],
  ['今天', 'jīn tiān', 'jintian', 'today', '1'],
  ['我们', 'wǒ men', 'women', 'we', '1'],
  ['去', 'qù', 'qu', 'to go', '1'],
  ['北京', 'Běi jīng', 'beijing', 'Beijing', '1'],
  ['月亮', 'yuè liang', 'yueliang', 'moon', '3'],
  ['思念', 'sī niàn', 'sinian', 'to miss', '5'],
]
  .map((r) => r.join('\t'))
  .join('\n');

// Original practice lines, repeated to look like a song.
const LYRICS = Array.from({ length: 4 }, (_, i) => `[00:${String(10 + i * 8).padStart(2, '0')}.00] 我爱你 今天我们去北京\n[00:${String(14 + i * 8).padStart(2, '0')}.00] 月亮 思念 你 啊`).join('\n');

function track(id: string, name: string, artist: string) {
  return { id, name, uri: `spotify:track:${id}`, duration_ms: 200000, artists: [{ name: artist }], album: { images: [] }, external_urls: { spotify: `https://open.spotify.com/track/${id}` } };
}

async function mock(page: Page) {
  const calls: string[] = [];
  await page.route('**/dict/cedict.tsv', (r) => r.fulfill({ body: DICT, contentType: 'text/plain' }));
  await page.route('**/dict/t2s.json', (r) => r.fulfill({ json: { 愛: '爱' } }));
  await page.route('https://api.spotify.com/v1/**', async (r) => {
    const url = new URL(r.request().url());
    calls.push(`${r.request().method()} ${url.pathname}`);
    if (url.pathname === '/v1/me/top/artists') return r.fulfill({ json: { items: [{ name: 'Some Band', genres: ['indie rock'] }, { name: '某歌手', genres: ['mandopop'] }] } });
    if (url.pathname === '/v1/search') {
      const n = calls.filter((c) => c.endsWith('/v1/search')).length;
      return r.fulfill({ json: { tracks: { items: [track(`t${n}a`, `歌${n}`, `歌手${n}`), track(`t${n}b`, `English ${n}`, `Singer ${n}`)] } } });
    }
    if (url.pathname === '/v1/me/playlists') return r.fulfill({ json: { id: 'pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } } });
    if (url.pathname.startsWith('/v1/playlists/')) return r.fulfill({ status: 200, json: { snapshot_id: 'x' } });
    if (url.pathname === '/v1/me/player/currently-playing') return r.fulfill({ json: { item: track('t1a', '歌1', '歌手1'), progress_ms: 15000, is_playing: true, currently_playing_type: 'track' } });
    return r.fulfill({ status: 404, json: { error: { message: 'not mocked' } } });
  });
  await page.route('https://lrclib.net/api/**', (r) => {
    const name = new URL(r.request().url()).searchParams.get('track_name') ?? '';
    if (name.startsWith('English')) return r.fulfill({ json: { trackName: name, artistName: 'x', duration: 200, instrumental: false, plainLyrics: 'just english words here '.repeat(20), syncedLyrics: null } });
    return r.fulfill({ json: { trackName: name, artistName: 'x', duration: 200, instrumental: false, plainLyrics: null, syncedLyrics: LYRICS } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('spotify:auth', JSON.stringify({ access: 'test', refresh: 'r', expiresAt: Date.now() + 3600e3, scope: 'user-read-private user-top-read playlist-read-private playlist-modify-private playlist-modify-public user-read-currently-playing' }));
  });
  return calls;
}

test('music: find songs at my level, save a playlist, read lyrics', async ({ page }) => {
  const calls = await mock(page);
  await page.goto('./#/music');
  await expect(page.getByRole('heading', { name: 'Music' })).toBeVisible();
  // Genres were picked from the mocked top artists.
  await expect(page.getByRole('button', { name: /Mandopop/, pressed: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find songs' }).click();
  await expect(page.getByText(/\d+ songs$/)).toBeVisible({ timeout: 30_000 });
  // English songs are filtered out; Chinese ones are scored.
  await expect(page.getByText('English 1')).toHaveCount(0);
  await expect(page.getByText(/you know \d+%/).first()).toBeVisible();

  const shot = async (n: string) => process.env.SHOT && (await page.screenshot({ path: `${process.env.SHOT}/${n}.png`, fullPage: true }));
  await shot('music');
  await page.getByRole('button', { name: 'Save as Spotify playlist' }).click();
  await expect(page.getByText('Open the playlist in Spotify')).toBeVisible();
  expect(calls).toContain('POST /v1/me/playlists');
  expect(calls.some((c) => c.startsWith('PUT /v1/playlists/pl1/'))).toBe(true);

  await page.locator('ul li button').first().click();
  await expect(page.getByRole('heading', { name: 'Lyrics' })).toBeVisible();
  await page.getByRole('button', { name: /思念/ }).first().click();
  await expect(page.getByText('to miss')).toBeVisible();
  await shot('word');
  await page.getByRole('button', { name: '+ Add to my practice' }).click();
  await expect(page.getByRole('button', { name: '✓ In my practice' })).toBeVisible();

  await page.goto('./#/music/now');
  await expect(page.getByRole('heading', { name: 'Follow along' })).toBeVisible();
  await expect(page.getByText('歌1')).toBeVisible();
  await shot('now');
});
