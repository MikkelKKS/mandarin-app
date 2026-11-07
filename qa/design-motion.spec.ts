import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Motion capture for the design-experience reviewer and the design-judge (/design-review, /design-loop). Run with
 * `npm run design:motion -- <outDir>` (scripts/design-preview.ts sets DESIGN_REVIEW=1).
 *
 * Screenshots can't show motion, and Playwright's recordVideo needs its own ffmpeg download
 * (which hangs on Mikkel's PC), so this records frame sequences with Chrome's screencast
 * (every painted frame, with its timestamp): <DESIGN_OUT>/motion/<phone|pc>/<reduced|full>/<interaction>/<ms>.jpg
 * Each interaction folder also gets frames.txt (frame times) so timing and easing can be read off.
 * Runs twice: normal motion and prefers-reduced-motion: reduce.
 */
const OUT = process.env.DESIGN_OUT ?? 'design-review/current';

async function record(page: Page, dir: string, action: () => Promise<void>, ms = 1200) {
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: { t: number; data: string }[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: f.metadata.timestamp ?? Date.now() / 1000, data: f.data });
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  await page.waitForTimeout(100);
  const start = Date.now() / 1000;
  await action();
  await page.waitForTimeout(ms);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const lines: string[] = [];
  for (const f of frames) {
    const rel = Math.max(0, Math.round((f.t - start) * 1000));
    const name = `${String(rel).padStart(5, '0')}.jpg`;
    writeFileSync(`${dir}/${name}`, Buffer.from(f.data, 'base64'));
    lines.push(`${name}  ${rel} ms`);
  }
  writeFileSync(`${dir}/frames.txt`, `${frames.length} frames (only painted frames are sent; gaps = nothing changed)\n${lines.join('\n')}\n`);
}

const setVerdict = (page: Page, v: 'correct' | 'wrong' | undefined) =>
  page.evaluate((x) => {
    (globalThis as unknown as { __e2eVerdict?: string }).__e2eVerdict = x;
  }, v);

/** Step through the session until a question is on screen (not answered). */
async function toQuestion(page: Page) {
  for (let i = 0; i < 80; i++) {
    if (await page.getByRole('option', { disabled: false }).first().isVisible().catch(() => false)) return;
    if (await page.getByLabel('Your answer in pinyin').isVisible().catch(() => false)) return;
    for (const name of ['Continue', 'Got it', 'Show the answer']) {
      const b = page.getByRole('button', { name, disabled: false }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        // Wait for the feedback sheet's exit before looking again (see qa/design.spec.ts).
        if (name === 'Continue') await expect(page.getByRole('status').getByRole('button', { name: 'Continue' })).toBeHidden();
        break;
      }
    }
    await page.waitForTimeout(120);
  }
}

async function answerNow(page: Page) {
  const input = page.getByLabel('Your answer in pinyin');
  if (await input.isVisible().catch(() => false)) {
    await input.fill('ma1');
    await page.getByRole('button', { name: 'Check' }).click();
  } else await page.getByRole('option', { disabled: false }).first().click();
}

for (const motion of ['full', 'reduced'] as const) {
  test.describe(motion, () => {
    test.use({ contextOptions: { reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' }, serviceWorkers: 'block' });
    test(`motion (${motion})`, async ({ page }, info) => {
      test.setTimeout(240_000);
      await page.route('**/audio/**', (r) => r.abort());
      const base = `${OUT}/motion/${info.project.name}/${motion}`;

      await page.goto('./');
      await page.waitForLoadState('networkidle');
      // 1. Page transition: home → library (tab bar).
      await record(page, `${base}/page-transition`, () => page.getByRole('link', { name: 'Library' }).or(page.getByRole('button', { name: 'Library' })).first().click(), 700);

      // 2–3. Session: a wrong and a right answer (feedback sheet, colours, combo/XP).
      await page.goto('./#/session/quick');
      await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 20000 });
      await toQuestion(page);
      await setVerdict(page, 'wrong');
      await record(page, `${base}/answer-wrong`, () => answerNow(page));
      await page.getByRole('button', { name: 'Continue' }).first().click();
      await expect(page.getByRole('status').getByRole('button', { name: 'Continue' })).toBeHidden();
      await toQuestion(page);
      await setVerdict(page, 'correct');
      await record(page, `${base}/answer-right`, () => answerNow(page));
      // 4. Next question coming in.
      await record(page, `${base}/next-question`, () => page.getByRole('button', { name: 'Continue' }).first().click(), 700);
      await setVerdict(page, undefined);

      // 5. Tone Gym answer.
      await page.goto('./#/tone-gym/single');
      await expect(page.getByRole('button', { name: '1st tone' })).toBeVisible({ timeout: 20000 });
      await record(page, `${base}/tone-gym-answer`, () => page.getByRole('button', { name: '2nd tone' }).first().click());
    });
  });
}
