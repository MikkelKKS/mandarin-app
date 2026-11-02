import { expect, test } from '@playwright/test';

/**
 * Visits every main screen, saves a full-page screenshot, and fails on
 * console errors, page crashes or content wider than the screen.
 * The qa agent adds its own temporary specs next to this one for whatever just changed.
 */
const SCREENS: [string, string][] = [
  ['home', ''],
  ['tone-gym', 'tone-gym'],
  ['reading', 'reading'],
  ['library', 'library'],
  ['conversations', 'conversations'],
  ['stories', 'read'],
  ['music', 'music'],
  ['dictionary', 'dictionary'],
  ['words', 'words'],
  ['grammar', 'grammar'],
  ['stats', 'progress'],
  ['settings', 'settings'],
  ['placement', 'placement'],
  ['about', 'about'],
];

for (const [name, hash] of SCREENS) {
  test(`screen: ${name}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/audio|Failed to load resource|supabase/i.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.route('**/audio/**', (r) => r.abort());
    await page.goto(`./#/${hash}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `qa-screenshots/${info.project.name}/${name}.png`, fullPage: true });
    await expect(page.getByText(/This screen stopped working/)).toHaveCount(0);
    const overflow = (await page.evaluate("document.documentElement.scrollWidth - window.innerWidth")) as number;
    expect(overflow, 'page is wider than the screen (horizontal scroll)').toBeLessThanOrEqual(1);
    expect(errors, 'console errors').toEqual([]);
  });
}
