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
  await status.getByRole('button', { name: 'Look up' }).click();
  const sheet = page.getByRole('dialog', { name: 'Dictionary' });
  await expect(sheet).toBeVisible();
  const box = sheet.getByRole('textbox', { name: 'Search the dictionary' });
  await expect(box).not.toHaveValue('');
  // Typing and Enter stay in the dictionary (they don't move the session on).
  await box.fill('是');
  await box.press('Enter');
  await expect(sheet.getByText('to be')).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to the lesson' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(status.getByRole('button', { name: 'Continue' })).toBeVisible();
});
