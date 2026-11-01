import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Library → Grammar: read a topic, practise it, and it gets a review card', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/library');
  await page.getByRole('button', { name: /Grammar/ }).click();
  await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible();
  await expect(page.getByText(/0 of \d+ practised/)).toBeVisible();
  await page.getByRole('button', { name: /Basic word order/ }).click();
  await expect(page.getByText('Subject + Verb + Object')).toBeVisible();
  // Characters on and off, from the page itself.
  await page.getByRole('radio', { name: 'Both' }).click();
  await expect(page.getByText('我喝茶。').first()).toBeVisible();
  await page.getByRole('button', { name: 'Practise this' }).click();

  for (let i = 0; i < 6; i++) {
    await expect(page.getByRole('progressbar', { name: 'Practice progress' })).toHaveAttribute('aria-valuenow', String(i));
    if (i === 0) {
      // "I don't know" is there too.
      await page.getByRole('button', { name: "I don't know" }).click();
    } else if (await page.getByText('Put the words in order').isVisible()) {
      const tiles = page.getByLabel('Word tiles').locator('button:enabled');
      while ((await tiles.count()) > 0) await tiles.first().click();
      await page.getByRole('button', { name: 'Check' }).click();
    } else {
      await page.getByRole('option').first().click();
    }
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: /Continue|See the result/ }).click();
  }
  await expect(page.getByText('Practice done')).toBeVisible();
  await expect(page.getByText(/comes back in your sessions/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to Grammar' }).click();
  await expect(page.getByText(/1 of \d+ practised/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Basic word order/ })).toContainText(/Practised|Due for practice/);
});
