import { expect, test } from '@playwright/test';

// One second of silence, so clips "play" without the network.
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

test.use({ serviceWorkers: 'block' });

test('leaving a story stops the conversation audio', async ({ page }) => {
  await page.addInitScript(() => {
    const g = globalThis as unknown as { __plays: number };
    g.__plays = 0;
    const proto = (globalThis as unknown as { HTMLMediaElement: { prototype: { play: (this: unknown) => Promise<void> } } }).HTMLMediaElement.prototype;
    const orig = proto.play;
    proto.play = function (this: unknown) {
      g.__plays++;
      return orig.call(this);
    };
  });
  await page.route('**/audio/**', async (r) => {
    const body = Buffer.from(SILENCE.split(',')[1], 'base64');
    await new Promise((res) => setTimeout(res, 400));
    await r.fulfill({ body, contentType: 'audio/wav' });
  });
  await page.goto('./');
  await page.goto('./#/lesson/n01-story');
  await page.getByRole('button', { name: 'Play conversation', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Leave story' }).click();
  await expect(page.getByRole('button', { name: 'Play conversation', exact: true })).toHaveCount(0);
  const plays = await page.evaluate(() => (globalThis as unknown as { __plays: number }).__plays);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (globalThis as unknown as { __plays: number }).__plays)).toBe(plays);
});
