import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('pick a starting level: words below it are marked known', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/placement');
  await page.getByRole('radio', { name: '3' }).click();
  const start = page.getByRole('button', { name: /Start at HSK 3 \([\d,]+ words known\)/ });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByText(/words marked as known/)).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Know some Chinese already?')).toHaveCount(0);
});

test('the test stops after a level that goes badly', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/placement');
  await page.getByRole('button', { name: 'Start the test' }).click();
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', { name: "I don't know" }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByText('0 of 8 right')).toBeVisible();
  await expect(page.getByText('HSK 2')).toHaveCount(0);
});
