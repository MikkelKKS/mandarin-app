import { expect, test, type Page } from '@playwright/test';

/** Answer whatever exercise is on screen (correctness doesn't matter: wrong answers are re-queued, then pass). */
async function step(page: Page) {
  const done = page.getByText('Fixed along the way');
  if (await done.isVisible()) return true;
  if (await page.getByRole('heading', { name: 'Conversations', exact: true }).isVisible()) return true;

  const cont = page.getByRole('button', { name: /^(Continue|Got it)$/ });
  if (await cont.first().isVisible()) {
    await cont.first().click();
    return false;
  }

  if (await page.getByText('Match the pairs').isVisible()) {
    const cols = page.locator('main .grid.grid-cols-2 > div');
    const left = cols.nth(0).locator('button');
    const right = cols.nth(1).locator('button');
    const n = await left.count();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (await left.nth(i).isDisabled()) break;
        if (await right.nth(j).isDisabled()) continue;
        await left.nth(i).click();
        await right.nth(j).click();
        await page.waitForTimeout(500);
      }
    }
    return false;
  }

  const t = { timeout: 3000 };
  try {
    const input = page.getByLabel('Your answer in pinyin');
    if (await input.isVisible()) await input.fill('ni3 hao3', t);
    else if (await page.getByRole('option').first().isVisible()) await page.getByRole('option').first().click(t);
    else if (await page.getByLabel('Word tiles').isVisible()) await page.getByLabel('Word tiles').locator('button:enabled').first().click(t);
    else {
      const tones = page.getByRole('button', { name: /^Tone high/ });
      for (let i = 0; i < (await tones.count()); i++) await tones.nth(i).click(t);
    }
    const check = page.getByRole('button', { name: 'Check' });
    if ((await check.isVisible()) && (await check.isEnabled())) await check.click(t);
  } catch {
    // the screen changed under us; try again on the next step
  }
  return false;
}

test('complete the first lesson: it counts in Conversations and in Stats', async ({ page }) => {
  // Wrong answers now repeat until right, so the random-answer bot is graded as correct.
  await page.addInitScript(() => {
    (globalThis as unknown as { __e2eAlwaysCorrect: boolean }).__e2eAlwaysCorrect = true;
  });
  await page.goto('./#/conversations');
  await expect(page.getByRole('button', { name: /Check your basics/ })).toBeVisible();
  await page.getByRole('button', { name: /Hello & how are you/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('New word')).toBeVisible();

  let finished = false;
  for (let i = 0; i < 400 && !finished; i++) finished = await step(page);
  expect(finished).toBe(true);
  const end = page.getByText('Fixed along the way');
  if (await end.isVisible()) await page.getByRole('button', { name: 'Continue' }).click();
  // Done once, and nothing is locked.
  await expect(page.getByRole('button', { name: /Hello & how are you.*done 1×/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thanks & sorry/ })).toBeVisible();

  // The same words are now in the HSK system: Stats and today's queue show them.
  await page.goto('./#/progress');
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByText(/^[1-9]\d* \/ 511 started/)).toBeVisible({ timeout: 15000 });
  const cards = page.getByRole('region', { name: 'Review cards' });
  await expect(cards.getByText(/^Today: \d+ reviews? due, \d+ new words?/)).toBeVisible({ timeout: 15000 });
  const listening = cards.getByRole('row', { name: /Listening → meaning/ });
  await expect(listening.getByRole('cell').nth(1)).not.toHaveText('0');
});

test('keyboard only: Enter continues through intro cards', async ({ page }) => {
  await page.goto('./#/lesson/n00-numbers');
  await expect(page.getByText('New word')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('New word')).toBeVisible();
  await page.keyboard.press('Enter');
});

test('dictionary: look up a word and learn it next', async ({ page }) => {
  await page.goto('./#/library');
  await page.getByLabel('Look up in the dictionary').fill('nihao');
  await page.keyboard.press('Enter');
  await expect(page.getByText('hello / hi').or(page.getByText('hello; hi'))).toBeVisible();
  await page.getByRole('button', { name: 'Learn next' }).first().click();
  await expect(page.getByRole('button', { name: 'Learning next' }).first()).toBeVisible();
  await page.getByLabel('Search the dictionary').fill('');
  await expect(page.getByRole('heading', { name: 'Learning next' })).toBeVisible();
  await expect(page.getByText('nǐ hǎo').first()).toBeVisible();
});

test('role-play a story by typing one part', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const unit = JSON.parse(readFileSync('content/units/00-basics.json', 'utf8'));
  const pinyin = new Map<string, string>(unit.sentences.map((s: { id: string; pinyin: string }) => [s.id, s.pinyin]));
  const role = unit.dialogue.speakers[unit.dialogue.speakers.length - 1];
  const mine: string[] = unit.dialogue.lines.filter((l: { speaker: string }) => l.speaker === role.id).map((l: { sentence: string }) => pinyin.get(l.sentence)!);
  await page.goto('./#/lesson/n00-story/roleplay');
  await page.getByRole('button', { name: `Play as ${role.name}` }).click();
  for (const [i, p] of mine.entries()) {
    const input = page.getByLabel('Your answer in pinyin');
    await expect(input).toBeVisible({ timeout: 30_000 });
    // First line: a wrong try, then the retry.
    if (i === 0) {
      await input.fill('zzz');
      await page.getByRole('button', { name: 'Check' }).click();
      await page.getByRole('button', { name: 'Try again' }).click();
    }
    await input.fill(p);
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByText('Fixed along the way')).toBeVisible({ timeout: 30_000 });
});

test.describe('audio fallback', () => {
test.use({ serviceWorkers: 'block' });
test('plays the Azure recording first, and an older one when it is missing', async ({ page }) => {
  const requested: string[] = [];
  // No Azure recordings yet: every request for one fails.
  await page.route('**/audio/az/**', (r) => r.fulfill({ status: 404, body: '' }));
  page.on('request', (r) => r.url().includes('/audio/') && !r.url().includes('/dict/') && requested.push(new URL(r.url()).pathname));
  await page.goto('./#/lesson/n01-names');
  await expect(page.getByText('New word')).toBeVisible();
  requested.length = 0;
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.waitForTimeout(800);
  const az = requested.filter((p) => p.includes('/audio/az/'));
  const older = requested.filter((p) => p.includes('/audio/f/'));
  expect(az.length).toBeGreaterThan(0);
  // The missing Azure clip was followed by the older recording of the same item.
  expect(older.length).toBeGreaterThan(0);
  expect(requested.indexOf(az[0])).toBeLessThan(requested.indexOf(older[0]));
});
});

test('a unit opens to show its lessons; a lesson opens its sheet', async ({ page }) => {
  await page.goto('./#/conversations');
  const unit = page.getByRole('button', { name: /^Family/ });
  await unit.click();
  await expect(unit).toHaveAttribute('aria-expanded', 'true');
  const row = page.getByRole('listitem').filter({ has: unit });
  await row.getByRole('button', { name: /words known/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^(Start|Listen)$/ })).toBeInViewport();
});

test('read a story and look up a word', async ({ page }) => {
  await page.goto('./#/read');
  await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible();
  await expect(page.getByText(/You know \d+% of the words/).first()).toBeVisible();
  await page.getByRole('button', { name: /我叫米格/ }).click();
  await expect(page.getByRole('heading', { name: 'My day' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play all' })).toBeVisible();
  await page.locator('article button', { hasText: '丹麦' }).first().click();
  await expect(page.getByRole('dialog', { name: '丹麦' })).toBeVisible();
  await expect(page.getByText('Denmark').first()).toBeVisible();
  // Report its recording: it's queued for re-recording.
  await page.getByRole('dialog', { name: '丹麦' }).getByRole('button', { name: 'Report bad audio' }).click();
  await expect(page.getByText('Reported. It will be re-recorded.')).toBeVisible();
  // (A string, because the e2e TypeScript setup has no DOM types.)
  const reports = (await page.evaluate(`new Promise((done) => {
    const req = indexedDB.open('mandarin');
    req.onsuccess = () => {
      const q = req.result.transaction('audioReports').objectStore('audioReports').getAll();
      q.onsuccess = () => done(q.result);
    };
  })`)) as Array<{ hanzi: string; status: string }>;
  expect(reports).toEqual([expect.objectContaining({ hanzi: '丹麦', status: 'open' })]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Show English' }).click();
  await expect(page.getByText(/I live in Copenhagen/)).toBeVisible();
});

test('browse all HSK words grouped by what you know', async ({ page }) => {
  await page.goto('./#/progress');
  await page.getByRole('button', { name: 'Browse the words' }).click();
  await expect(page.getByRole('heading', { name: 'HSK words' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not started' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('tab', { name: '2' }).click();
  await page.getByRole('tab', { name: '1' }).click();
  await page.getByRole('button', { name: /^ài: / }).click();
  await expect(page.getByRole('dialog', { name: '爱' })).toBeVisible();
});
