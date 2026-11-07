import { expect, test, type Page } from '@playwright/test';
import { demoProfile } from './demoProfile';

/**
 * Design review screenshots (/design-review). Not part of the normal QA tour: run it with
 * `npm run design:shots -- <outDir> [screens]` (scripts/design-preview.ts), which sets DESIGN_REVIEW=1.
 *
 * For each width (phone 412px, pc 1440px, from playwright.qa.config.ts) and each colour scheme
 * (light, dark) it first shoots Home and Stats of a brand-new account (home-new, stats-new), then
 * loads a lived-in profile (qa/demoProfile.ts: ~6 weeks of history, a streak, a real tone matrix)
 * and plays one quick session on it (a question, a wrong and a right answer, the end screen), so
 * reviewers judge the app as it is used day to day.
 *
 * Output: <DESIGN_OUT>/<phone|pc>/<light|dark>/<screen>.png
 * DESIGN_SCREENS (comma list, optional) limits which screens are taken, e.g. "session,stats".
 */
const OUT = process.env.DESIGN_OUT ?? 'design-review/current';
const ONLY = (process.env.DESIGN_SCREENS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const want = (name: string) => !ONLY.length || ONLY.some((o) => name === o || name.startsWith(`${o}-`));

/** Main screens after the session: [name, hash]. */
const SCREENS: [string, string][] = [
  ['home', ''],
  ['tone-gym', 'tone-gym'],
  ['library', 'library'],
  ['stats', 'progress'],
  ['settings', 'settings'],
  ['music', 'music'],
];

type Verdict = 'correct' | 'wrong';
const setVerdict = (page: Page, v: Verdict | undefined) =>
  page.evaluate((x) => {
    (globalThis as unknown as { __e2eVerdict?: string }).__e2eVerdict = x;
  }, v);

async function clickIf(page: Page, name: string | RegExp) {
  const b = page.getByRole('button', { name, disabled: false }).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click();
    // The feedback sheet plays a short exit before the next question: wait until it's gone,
    // or the next step would click the leaving button again and wait for it forever.
    if (name === 'Continue') await expect(page.getByRole('status').getByRole('button', { name: 'Continue' })).toBeHidden();
    return true;
  }
  return false;
}

/** Answer whatever is on screen. Returns true if a question was answered. */
async function answer(page: Page): Promise<boolean> {
  const input = page.getByLabel('Your answer in pinyin');
  if (await input.isVisible().catch(() => false)) {
    await input.fill('ma1');
    await page.getByRole('button', { name: 'Check' }).click();
    return true;
  }
  if (await clickIf(page, /^1st tone/)) {
    await clickIf(page, /^2nd tone, syllable 2/);
    return true;
  }
  const option = page.getByRole('option', { disabled: false }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return true;
  }
  return false;
}

const isQuestion = async (page: Page) =>
  (await page.getByLabel('Your answer in pinyin').isVisible().catch(() => false)) ||
  (await page.getByRole('option', { disabled: false }).first().isVisible().catch(() => false)) ||
  (await page.getByRole('button', { name: /^1st tone/ }).first().isVisible().catch(() => false));

async function shot(page: Page, dir: string, name: string, fullPage = true) {
  if (!want(name)) return;
  await page.waitForTimeout(450); // let entry animations settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

/** Replace the review cards and log with the lived-in profile, then reload so the app reads it. */
async function seedProfile(page: Page) {
  const data = JSON.stringify(demoProfile());
  // A string, because the spec is type-checked without the browser's types.
  await page.evaluate(`new Promise((done, fail) => {
    const d = ${data};
    const req = indexedDB.open('mandarin');
    req.onerror = () => fail(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(['reviewItems', 'reviewLogs', 'gameScores'], 'readwrite');
      const items = tx.objectStore('reviewItems');
      const logs = tx.objectStore('reviewLogs');
      items.clear();
      logs.clear();
      for (const r of d.items) items.put(r);
      for (const r of d.logs) logs.put(r);
      tx.objectStore('gameScores').put(d.sessions);
      tx.oncomplete = () => { req.result.close(); done(); };
      tx.onerror = () => fail(tx.error);
    };
  })`);
  await page.reload();
  // Let Home unlock the achievements this history has already earned, so the session end only shows new ones.
  await expect(page.getByText(/day streak/).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function playSession(page: Page, dir: string) {
  await page.goto('./#/session/quick');
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 20000 });
  const todo: Verdict[] = ['wrong', 'correct'];
  let asked = false;
  let skips = 0;
  for (let i = 0; i < 250; i++) {
    if (await page.getByText(/session done/).isVisible().catch(() => false)) {
      await page.waitForTimeout(2500); // the end screen's XP count-up, level bar and achievements play in over ~2 s
      await shot(page, dir, 'session-end');
      return;
    }
    if (await page.getByText(/^New word/).first().isVisible().catch(() => false)) {
      if (i < 3) await shot(page, dir, 'session-intro', false);
    }
    // Feedback sheet first: its Continue moves on (the options under it are disabled).
    if (await clickIf(page, 'Continue')) continue;
    if (todo.length && (await isQuestion(page))) {
      // Only the first exposure of a new word is multiple choice; skip ahead to a review-style question if we can.
      if (!asked) {
        await shot(page, dir, 'session-question', false);
        asked = true;
      }
      const v = todo[0];
      // A forced verdict can't move a multiple-choice pick (a forced "right" shows the pick crossed out,
      // a forced "wrong" shows no cross), so on choice questions the shots wait for a genuinely right or
      // wrong answer; typed questions are forced, as a typed answer has no option state.
      if (skips < 40 && !(await page.getByLabel('Your answer in pinyin').isVisible().catch(() => false))) {
        skips++;
        await setVerdict(page, undefined);
        await answer(page);
        const hit = page.getByRole('status').filter({ hasText: v === 'wrong' ? 'Not quite' : /^Right/ });
        if (await hit.first().waitFor({ timeout: 2500 }).then(() => true, () => false)) {
          await shot(page, dir, v === 'wrong' ? 'session-wrong' : 'session-right', false);
          todo.shift();
        }
        continue;
      }
      await setVerdict(page, v);
      await answer(page);
      const status = page.getByRole('status').filter({ hasText: v === 'wrong' ? 'Not quite' : /^Right/ });
      if (await status.first().waitFor({ timeout: 2500 }).then(() => true, () => false)) {
        await shot(page, dir, v === 'wrong' ? 'session-wrong' : 'session-right', false);
        todo.shift();
        if (!todo.length) await setVerdict(page, undefined);
      }
      continue;
    }
    if (await clickIf(page, 'Got it')) continue;
    if (await clickIf(page, 'Show the answer')) continue;
    if (await clickIf(page, /^Good/)) continue;
    if (await clickIf(page, 'Show what it says')) continue;
    if (await clickIf(page, 'Yes')) continue;
    if (!(await answer(page))) await page.waitForTimeout(150);
  }
}

async function toneGym(page: Page, dir: string) {
  await page.goto('./#/tone-gym/single');
  await expect(page.getByRole('button', { name: '1st tone' })).toBeVisible({ timeout: 20000 });
  await shot(page, dir, 'tone-gym-question', false);
  await page.getByRole('button', { name: '2nd tone' }).first().click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await shot(page, dir, 'tone-gym-feedback', false);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme, serviceWorkers: 'block' });
    test(`design screens (${scheme})`, async ({ page }, info) => {
      test.setTimeout(300_000);
      await page.route('**/audio/**', (r) => r.abort());
      const dir = `${OUT}/${info.project.name}/${scheme}`;
      await page.goto('./');
      for (const [name, hash] of [['home-new', ''], ['stats-new', 'progress']] as const) {
        if (!want(name)) continue;
        await page.goto(`./#/${hash}`);
        await page.waitForLoadState('networkidle');
        await shot(page, dir, name);
      }
      await page.goto('./');
      await expect(page.getByRole('main')).toBeVisible({ timeout: 20000 });
      await seedProfile(page);
      if (!ONLY.length || ONLY.some((o) => o.startsWith('session') || ['home', 'stats'].includes(o))) await playSession(page, dir);
      if (want('tone-gym-question') || want('tone-gym-feedback')) await toneGym(page, dir);
      for (const [name, hash] of SCREENS) {
        if (!want(name)) continue;
        await page.goto(`./#/${hash}`);
        await page.waitForLoadState('networkidle');
        await shot(page, dir, name);
      }
    });
  });
}
