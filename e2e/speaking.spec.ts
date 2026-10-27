import { expect, test } from '@playwright/test';

// Chrome's fake microphone plays a beep, which is enough to get a pitch curve.
test.use({
  serviceWorkers: 'block',
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

/** A word you know by ear (listening card in long-term review), so speaking starts on it. */
const SEED = `new Promise((done) => {
  const req = indexedDB.open('mandarin');
  req.onsuccess = () => {
    const now = Date.now();
    const tx = req.result.transaction('reviewItems', 'readwrite');
    tx.objectStore('reviewItems').put({ id: 'ni3-l1kpx#lm', word: 'ni3-l1kpx', facet: 'lm', due: now + 30 * 864e5, stability: 30, difficulty: 5,
      elapsedDays: 0, scheduledDays: 30, learningSteps: 0, reps: 5, lapses: 0, state: 2, lastReview: now - 864e5, updatedAt: now });
    tx.oncomplete = () => done(true);
  };
})`;

test('speaking in a deep session: record, see both pitch curves, grade', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText(/day streak/)).toBeVisible();
  await page.evaluate(SEED);
  await page.goto('./#/session/deep');
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 20000 });
  // Jump straight to the speaking part: leave and check the plan has one.
  const plan = (await page.evaluate(`new Promise((done) => {
    const req = indexedDB.open('mandarin');
    req.onsuccess = () => { const q = req.result.transaction('settings').objectStore('settings').get('session'); q.onsuccess = () => done(q.result.plan.blocks.map((b) => b.id)); };
  })`)) as string[];
  expect(plan).toContain('speaking');
  // Fast-forward the saved session to the speaking block and resume it.
  await page.evaluate(`new Promise((done) => {
    const req = indexedDB.open('mandarin');
    req.onsuccess = () => {
      const tx = req.result.transaction('settings', 'readwrite');
      const st = tx.objectStore('settings');
      const q = st.get('session');
      q.onsuccess = () => { const s = q.result; s.block = s.plan.blocks.findIndex((b) => b.id === 'speaking'); s.item = 0; s.updatedAt = Date.now(); st.put(s); };
      tx.oncomplete = () => done(true);
    };
  })`);
  await page.goto('./#/session/resume');
  await expect(page.getByText('Say it like the recording')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'B: you' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('img', { name: 'Pitch: the native speaker and you' })).toBeVisible();
  await page.getByRole('button', { name: /^Good/ }).click();
  // Graded: a speaking card now exists.
  const sp = await page.evaluate(`new Promise((done) => {
    const req = indexedDB.open('mandarin');
    req.onsuccess = () => { const q = req.result.transaction('reviewItems').objectStore('reviewItems').get('ni3-l1kpx#sp'); q.onsuccess = () => done(q.result && q.result.reps); };
  })`);
  expect(sp).toBe(1);
});

test('"No mic right now" takes speaking out of the session', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText(/day streak/)).toBeVisible();
  await page.evaluate(SEED);
  await page.getByRole('button', { name: 'No mic right now' }).click();
  await expect(page.getByText(/Speaking paused until/)).toBeVisible();
  await page.goto('./#/session/deep');
  await expect(page.getByRole('progressbar', { name: 'Session progress' })).toBeVisible({ timeout: 20000 });
  const plan = (await page.evaluate(`new Promise((done) => {
    const req = indexedDB.open('mandarin');
    req.onsuccess = () => { const q = req.result.transaction('settings').objectStore('settings').get('session'); q.onsuccess = () => done(q.result.plan.blocks.map((b) => b.id)); };
  })`)) as string[];
  expect(plan).not.toContain('speaking');
});
