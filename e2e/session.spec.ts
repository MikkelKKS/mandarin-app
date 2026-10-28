import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Answer whatever the session shows. Returns true once the end screen is up. */
async function step(page: Page): Promise<boolean> {
  if (await page.getByText(/session done/).isVisible()) return true;
  const click = async (name: string | RegExp) => {
    const b = page.getByRole('button', { name }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      return true;
    }
    return false;
  };
  if (await click('Continue')) return false;
  if (await click('Got it')) return false;
  if (await click('Show the answer')) return false;
  if (await click(/^Good/)) return false;
  if (await click('Show what it says')) return false;
  if (await click('Yes')) return false;
  const input = page.getByLabel('Your answer in pinyin');
  if (await input.isVisible().catch(() => false)) {
    await input.fill('ma1');
    await page.getByRole('button', { name: 'Check' }).click();
    return false;
  }
  if (await click(/^1st tone/)) {
    await click(/^2nd tone, syllable 2/);
    return false;
  }
  const option = page.getByRole('option').first();
  if (await option.isVisible().catch(() => false)) await option.click();
  else await page.waitForTimeout(150);
  return false;
}

test('a quick session from the home screen earns XP and counts towards the goal', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./');
  await expect(page.getByText(/day streak/)).toBeVisible();
  await expect(page.getByText(/new words? today/)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Quick session/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 15000 });
  // A fresh start: new words first.
  await expect(page.getByText(/^New word/).first()).toBeVisible();
  let done = false;
  let toneQuestions = 0;
  for (let i = 0; i < 200 && !done; i++) {
    if (await page.getByText(/^Tone Gym: which tone/).isVisible()) toneQuestions++;
    done = await step(page);
  }
  expect(done).toBe(true);
  // Tone questions stay in the Tone Gym unless turned on in Settings.
  expect(toneQuestions).toBe(0);
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await expect(page.getByText(/New words \(\d\)/)).toBeVisible();
  await expect(page.getByText('First session')).toBeVisible(); // achievement
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByText(/Today: \d+ of 100 XP|Today's goal: done/)).toBeVisible();
  // The new words now have review cards.
  await page.goto('./#/progress');
  await expect(page.getByRole('region', { name: 'Review cards' }).getByText(/^Today:/)).toBeVisible({ timeout: 15000 });
});

test('an interrupted session can be resumed', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./#/session/quick');
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 15000 });
  await step(page);
  await step(page);
  await page.getByRole('button', { name: /Leave the session/ }).click();
  await expect(page.getByRole('button', { name: /Resume your quick session/ })).toBeVisible();
  await page.getByRole('button', { name: /Resume your quick session/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).not.toHaveAttribute('aria-valuenow', '0');
});
