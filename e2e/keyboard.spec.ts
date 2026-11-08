import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// Phone only: the on-screen keyboard is simulated by shrinking the viewport.
test('the pinyin field stays visible above the bottom bar when the keyboard opens', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  await page.goto('./#/session/quick');
  const input = page.getByLabel('Your answer in pinyin');
  // Click through until a typed question shows up.
  for (let i = 0; i < 80 && !(await input.isVisible().catch(() => false)); i++) {
    for (const name of ['Continue', 'Got it', 'Show the answer', /^Good/, 'Show what it says', 'Yes'] as const) {
      const b = page.getByRole('button', { name }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {});
        break;
      }
    }
    const tone = page.getByRole('button', { name: /^1st tone/ }).first();
    if (await tone.isVisible().catch(() => false)) {
      await tone.click({ timeout: 2000 }).catch(() => {});
      await page.getByRole('button', { name: /^2nd tone, syllable 2/ }).first().click({ timeout: 1000 }).catch(() => {});
    }
    const option = page.getByRole('option').first();
    if (await option.isVisible().catch(() => false)) await option.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await expect(input).toBeVisible();
  await input.focus();
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.5) });
  await expect(page.locator('html')).toHaveAttribute('data-kb', 'open');
  await input.pressSequentially('ni3');
  await page.waitForTimeout(300);
  const box = (await page.locator('[data-typebox]').boundingBox())!;
  const bar = (await page.locator('.kb-bar').first().boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
});
