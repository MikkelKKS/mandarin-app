import { expect, test } from '@playwright/test';

// "I don't know" is offered on every kind of question, and shows the answer.
test.use({ serviceWorkers: 'block' });

test('lesson: I don’t know shows the answer as a miss', async ({ page }) => {
  await page.goto('./#/conversations');
  await page.getByRole('button', { name: /Hello & how are you/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  // Past the new-word cards (no "I don't know" there) to the first question.
  for (let i = 0; i < 20 && !(await page.getByRole('button', { name: "I don't know" }).isVisible()); i++) {
    await page.getByRole('button', { name: 'Continue' }).first().click();
  }
  await page.getByRole('button', { name: "I don't know" }).click();
  await expect(page.getByText('Not quite')).toBeVisible();
  await expect(page.getByText(/Here's the answer/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'I was right: my answer means the same' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Got it' }).click();
});

test('Tone Gym: I don’t know tells you the tone', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/tone-gym/single');
  await page.getByRole('button', { name: "I don't know" }).click();
  await expect(page.getByText(/^It was [0-9-]+$/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});

test('a session: every question after the new-word cards has I don’t know', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./');
  await page.getByRole('button', { name: /Quick session/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 15000 });
  let gaveUp = 0;
  for (let i = 0; i < 200; i++) {
    if (await page.getByText(/session done/).isVisible()) break;
    const cont = page.getByRole('button', { name: /^(Continue|Got it)$/ }).first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
      continue;
    }
    const dk = page.getByRole('button', { name: /^I don't know/ }).first();
    if (await dk.isVisible().catch(() => false)) {
      await dk.click();
      gaveUp++;
      continue;
    }
    await page.waitForTimeout(150);
  }
  await expect(page.getByText(/session done/)).toBeVisible();
  expect(gaveUp).toBeGreaterThan(3);
});
