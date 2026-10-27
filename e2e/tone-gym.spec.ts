import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('play a Tone Gym round of tone pairs and see the matrix', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/tone-gym');
  await expect(page.getByRole('heading', { name: 'Tone Gym' })).toBeVisible();
  await page.getByRole('button', { name: /Tone pairs/ }).click();
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: '2nd tone' }).first().click();
    await page.getByRole('button', { name: '3rd tone' }).nth(1).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByText(/Personal best|New personal best/)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Tone confusion matrix' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Tone Gym' }).click();
  // The answers feed the matrix and the best score.
  await expect(page.getByRole('table', { name: 'Tone confusion matrix' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tone pairs/ })).toContainText(/\d+\/20/);
});

test('keyboard: digits answer a single tone, Enter continues', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/tone-gym/single');
  await expect(page.getByRole('button', { name: '1st tone' })).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});
