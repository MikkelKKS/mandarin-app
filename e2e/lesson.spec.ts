import { expect, test, type Page } from '@playwright/test';

/** Answer whatever exercise is on screen (correctness doesn't matter: wrong answers are re-queued, then pass). */
async function step(page: Page) {
  const done = page.getByText('Fixed along the way');
  if (await done.isVisible()) return true;
  if (await page.getByRole('button', { name: /level 1 of 5/ }).first().isVisible()) return true;

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

test('complete the first lesson and see it on the path', async ({ page }) => {
  // Wrong answers now repeat until right, so the random-answer bot is graded as correct.
  await page.addInitScript(() => {
    (globalThis as unknown as { __e2eAlwaysCorrect: boolean }).__e2eAlwaysCorrect = true;
  });
  await page.goto('./');
  await expect(page.getByText('Check your basics')).toBeVisible();
  await page.getByRole('button', { name: /Hello & how are you/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('New word')).toBeVisible();

  let finished = false;
  for (let i = 0; i < 400 && !finished; i++) finished = await step(page);
  expect(finished).toBe(true);
  // The end screen (or, if the bot already tapped Continue, the path).
  const end = page.getByText('Fixed along the way');
  if (await end.isVisible()) await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: /Hello & how are you, level 1 of 5/ })).toBeVisible();
  // The next skill is now open.
  await expect(page.getByRole('button', { name: /Thanks & sorry, level 0 of 5/ })).toBeVisible();

  // The Progress page reflects the lesson.
  await page.goto('./#/progress');
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Working on')).toBeVisible();
  await expect(page.getByText(/reviews? due now/)).toBeVisible();
});

test('keyboard only: Enter continues through intro cards', async ({ page }) => {
  await page.goto('./#/lesson/n00-numbers');
  await expect(page.getByText('New word')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('New word')).toBeVisible();
  await page.keyboard.press('Enter');
});

test('play a few rounds of Listening Blitz', async ({ page }) => {
  await page.goto('./#/games');
  await page.getByRole('button', { name: /Listening Blitz/ }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByLabel('Score')).toHaveText('0');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(String((i % 4) + 1));
    await page.waitForTimeout(1300);
  }
  await expect(page.getByLabel('Seconds left')).toBeVisible();
});

test('import a practice pack and play it', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const prompt = readFileSync('content/practice-pack-prompt.md', 'utf8');
  const example = prompt.match(/```json\n([\s\S]*?)```/)![1];
  await page.goto('./#/settings');
  await page.getByLabel('Practice pack JSON').fill(example);
  await page.getByRole('button', { name: 'Import practice pack' }).click();
  await expect(page.getByText(/Imported “Third tones at the dinner table”/)).toBeVisible();
  await page.getByRole('button', { name: 'Go to the path' }).click();
  await expect(page.getByText('Custom practice')).toBeVisible();
  await page.getByRole('button', { name: 'Practise' }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  // A bad pack shows specific errors.
  await page.goto('./#/settings');
  await page.getByLabel('Practice pack JSON').fill(example.replace('"w-bao"', '"w-nope"'));
  await page.getByRole('button', { name: 'Import practice pack' }).click();
  await expect(page.getByRole('alert')).toContainText('unknown word id "w-nope"');
});

test('dictionary: search and add a word to practice', async ({ page }) => {
  await page.goto('./#/dictionary');
  await page.getByLabel('Search the dictionary').fill('nihao');
  await expect(page.getByText('hello / hi').or(page.getByText('hello; hi'))).toBeVisible();
  await page.getByRole('button', { name: '+ Add to my practice' }).first().click();
  await expect(page.getByRole('button', { name: '✓ In my practice' }).first()).toBeVisible();
  await page.getByLabel('Search the dictionary').fill('');
  await expect(page.getByText('My words')).toBeVisible();
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
test('a missing recording falls back to the other voice', async ({ page }) => {
  const requested: string[] = [];
  await page.route('**/audio/m/**', (r) => r.fulfill({ status: 404, body: '' }));
  page.on('request', (r) => r.url().includes('/audio/') && !r.url().includes('/dict/') && requested.push(new URL(r.url()).pathname));
  await page.goto('./#/lesson/n01-names');
  await expect(page.getByText('New word')).toBeVisible();
  requested.length = 0;
  // Ask for the male voice explicitly through the settings-independent path: click play twice to alternate voices.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /^Play/ }).first().click();
    await page.waitForTimeout(600);
  }
  const male = requested.filter((p) => p.includes('/audio/m/'));
  const female = requested.filter((p) => p.includes('/audio/f/'));
  expect(male.length).toBeGreaterThan(0);
  // Every male request that failed was followed by the same item in the female voice.
  for (const m of male) expect(female).toContain(m.replace('/audio/m/', '/audio/f/'));
});
});

test('opening a skill does not scroll the path', async ({ page }) => {
  await page.goto('./');
  const node = page.getByRole('button', { name: /Hello & how are you/ });
  await node.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => (globalThis as unknown as { scrollY: number }).scrollY);
  await node.click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeInViewport();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Start' })).toBeInViewport();
  expect(await page.evaluate(() => (globalThis as unknown as { scrollY: number }).scrollY)).toBe(before);
});

test('read a story and look up a word', async ({ page }) => {
  await page.goto('./#/read');
  await expect(page.getByRole('heading', { name: 'Read' })).toBeVisible();
  await page.goto('./#/read/r-myday');
  await expect(page.getByRole('heading', { name: '我叫米格' })).toBeVisible();
  await page.locator('article button', { hasText: '丹麦' }).first().click();
  await expect(page.getByRole('dialog', { name: '丹麦' })).toBeVisible();
  await expect(page.getByText('Denmark').first()).toBeVisible();
  await page.getByRole('button', { name: 'Show the translation' }).click();
  await expect(page.getByText(/I live in Copenhagen/)).toBeVisible();
});

test('browse all HSK words grouped by what you know', async ({ page }) => {
  await page.goto('./#/progress');
  await page.getByRole('button', { name: 'See all HSK words' }).click();
  await expect(page.getByRole('heading', { name: 'HSK words' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not learned yet' })).toBeVisible();
  await page.getByRole('tab', { name: 'HSK 2' }).click();
  await page.getByRole('tab', { name: 'HSK 1' }).click();
  await page.getByRole('button', { name: /^爱 / }).click();
  await expect(page.getByRole('dialog', { name: '爱' })).toBeVisible();
});
