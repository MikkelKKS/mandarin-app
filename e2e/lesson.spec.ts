import { expect, test, type Page } from '@playwright/test';

/** Answer whatever exercise is on screen (correctness doesn't matter: wrong answers are re-queued, then pass). */
async function step(page: Page) {
  const done = page.getByRole('heading', { name: /complete/i });
  if (await done.isVisible()) return true;

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
  await page.goto('./');
  await expect(page.getByText('Check your basics')).toBeVisible();
  await page.getByRole('button', { name: /Hello & how are you/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('New word')).toBeVisible();

  let finished = false;
  for (let i = 0; i < 120 && !finished; i++) finished = await step(page);
  expect(finished).toBe(true);
  await expect(page.getByText('Accuracy')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: /Hello & how are you — level 1 of 5/ })).toBeVisible();
  // The next skill is now open.
  await expect(page.getByRole('button', { name: /Thanks & sorry — level 0 of 5/ })).toBeVisible();
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
