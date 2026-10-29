import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Words you know by ear (placement: everything below HSK 2), so they're ready to read. */
async function knowHsk1(page: Page) {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/placement');
  await page.getByRole('radio', { name: '2' }).click();
  await page.getByRole('button', { name: /Start at HSK 2/ }).click();
  await expect(page.getByText(/words marked as known/)).toBeVisible();
}

test('Reading tab: choose a direction, meet characters, then read them', async ({ page }) => {
  await knowHsk1(page);
  await page.goto('./#/reading');
  await expect(page.getByRole('heading', { name: 'Reading', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /Character → meaning/ }).click();
  await expect(page.getByText('New today')).toBeVisible();
  await page.getByRole('button', { name: /Start a round/ }).click();
  // New characters are met first, with their sound and meaning.
  await expect(page.getByText(/New (character|word) to read|A character in/)).toBeVisible({ timeout: 20000 });
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByText('What does it mean?')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByRole('group', { name: 'Grade yourself' })).toBeVisible();
  await page.getByRole('button', { name: /^Good/ }).click();
  // The direction is remembered on this device.
  await page.goto('./#/reading');
  await expect(page.getByRole('radio', { name: /Character → meaning/ })).toHaveAttribute('aria-checked', 'true');
  // Stats has a Reading section, and the word stage is untouched.
  await page.goto('./#/progress');
  await expect(page.getByRole('heading', { name: 'Reading', exact: true })).toBeVisible();
  await expect(page.getByText('Reading retention, 30 days')).toBeVisible();
});

test('character → pinyin is typed and auto-graded, with the answer explained', async ({ page }) => {
  await knowHsk1(page);
  await page.goto('./#/reading');
  await page.getByRole('radio', { name: /Character → pinyin/ }).click();
  await page.getByRole('button', { name: /Start a round/ }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByText('Read it: type the pinyin with tones')).toBeVisible();
  await page.getByRole('textbox').fill('zzz');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I was right' })).toBeVisible();
  await expect(page.getByText(/Review grade/)).toBeVisible();
});

test('Stories: characters only, and how much of each story you can read', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/read');
  await expect(page.getByText(/You can read \d+% of the characters/).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button').filter({ hasText: /You know/ }).first().click();
  await page.getByRole('button', { name: 'Characters only' }).click();
  await expect(page.getByRole('button', { name: 'Characters only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/No pinyin. Tap a word/)).toBeVisible();
});

test('six tabs, Reading among them', async ({ page }) => {
  await page.goto('./#/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const t of ['Home', 'Tones', 'Reading', 'Library', 'Stats', 'Settings']) await expect(nav.getByRole('button', { name: t })).toBeVisible();
});
