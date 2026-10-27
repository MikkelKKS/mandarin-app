import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// Role-play is the quickest way to a typed answer: 米格 says "Nín hǎo! Wǒ jiào Mǐgé."
test.beforeEach(async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.goto('./');
  await page.goto('./#/lesson/n01-story/roleplay');
  await page.getByRole('button', { name: /^Play as/ }).first().click();
  await page.getByLabel('Your answer in pinyin').waitFor({ timeout: 20000 });
});

test('tone numbers turn into tone marks while typing', async ({ page }) => {
  const input = page.getByLabel('Your answer in pinyin');
  await input.pressSequentially('ni3hao3 lv4 nu:3');
  await expect(input).toHaveValue('nǐhǎo lǜ nǚ');
  // The tone row puts a tone on the last syllable.
  await input.fill('ma');
  await page.getByRole('button', { name: '3rd tone on the last syllable' }).click();
  await expect(input).toHaveValue('mǎ');
});

test('a wrong tone is shown syllable by syllable', async ({ page }) => {
  await page.getByLabel('Your answer in pinyin').fill('nin3 hao3 wo3 jiao4 mi3ge2 hen3');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('nín is 2nd tone, not 3rd.')).toBeVisible();
  const breakdown = page.getByLabel('Your answer, syllable by syllable');
  await expect(breakdown).toContainText('you: nǐn');
  await expect(breakdown).toContainText('Not in the answer: hěn');
});
