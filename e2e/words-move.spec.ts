import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('move words between not started, learning, young and mature', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/progress/words');
  const section = (title: string) => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const count = async (title: string) => Number(await section(title).locator('span.tabular-nums').innerText());
  await expect(section('Not started').getByRole('button').first()).toBeVisible();
  const total = await count('Not started');

  await page.getByRole('button', { name: 'Move words' }).click();
  // Pick three words and make them mature.
  for (let i = 0; i < 3; i++) await section('Not started').getByRole('listitem').nth(i).getByRole('button').click();
  await page.screenshot({ path: 'test-results/words-move.png' });
  await page.getByRole('group', { name: 'Move the selected words' }).getByRole('button', { name: 'Mature' }).click();
  await expect(page.getByText('3 words moved to Mature.')).toBeVisible();
  await expect.poll(() => count('Mature')).toBe(3);

  // A whole group at once: all mature words → learning.
  await page.getByRole('button', { name: 'Move words' }).click();
  await section('Mature').getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('group', { name: 'Move the selected words' }).getByRole('button', { name: 'Learning' }).click();
  await expect.poll(() => count('Learning')).toBe(3);

  // And back to not started.
  await page.getByRole('button', { name: 'Move words' }).click();
  await section('Learning').getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('group', { name: 'Move the selected words' }).getByRole('button', { name: 'Not started' }).click();
  await expect.poll(() => count('Not started')).toBe(total);
});
