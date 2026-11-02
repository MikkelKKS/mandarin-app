import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const DICT = [
  ['我', 'wǒ', 'wo', 'I / me', '1'],
  ['的', 'de', 'de', "of; 's", '1'],
  ['是', 'shì', 'shi', 'to be', '1'],
  ['不', 'bù', 'bu', 'not', '1'],
  ['了', 'le', 'le', '(completed action)', '1'],
]
  .map((r) => r.join('\t'))
  .join('\n');

test('after answering, "Look up" opens the dictionary over the session; closing it goes back to the same answer', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.route('**/dict/cedict.tsv', (r) => r.fulfill({ body: DICT, contentType: 'text/plain' }));
  await page.goto('./#/session/quick/x');
  // Meet the new words, then answer the first question.
  const got = page.getByRole('button', { name: 'Got it' });
  await expect(got).toBeVisible({ timeout: 20_000 });
  while (await got.isVisible()) await got.click();
  await page.getByRole('option').first().click();
  const status = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Continue' }) });
  await expect(status).toBeVisible();
  await status.getByText('More').click(); // the extra links sit behind More
  await status.getByRole('button', { name: 'Look up' }).click();
  const sheet = page.getByRole('dialog', { name: 'Dictionary' });
  await expect(sheet).toBeVisible();
  const box = sheet.getByRole('textbox', { name: 'Search the dictionary' });
  await expect(box).not.toHaveValue('');
  // Typing and Enter stay in the dictionary (they don't move the session on).
  await box.fill('是');
  await box.press('Enter');
  await expect(sheet.getByText('to be')).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to the exercise' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(status.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('the dictionary button opens the dictionary at any time, before answering too', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.route('**/dict/cedict.tsv', (r) => r.fulfill({ body: DICT, contentType: 'text/plain' }));
  await page.goto('./#/session/quick/x');
  const got = page.getByRole('button', { name: 'Got it' });
  await expect(got).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Open the dictionary' }).click();
  const sheet = page.getByRole('dialog', { name: 'Dictionary' });
  const box = sheet.getByRole('textbox', { name: 'Search the dictionary' });
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('');
  await page.keyboard.type('是');
  await expect(sheet.getByText('to be')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(got).toBeVisible();
  // In a lesson and the Tone Gym too.
  await page.goto('./#/tone-gym/single');
  await page.getByRole('button', { name: 'Open the dictionary' }).click();
  await expect(sheet).toBeVisible();
});
