import { defineConfig, devices } from '@playwright/test';
import { mutedLaunch } from './e2e/launch';

/**
 * QA screen tour (used by the qa agent, not by CI).
 * Run: npm run build && npx playwright test -c playwright.qa.config.ts
 * Screenshots land in qa-screenshots/ (git-ignored).
 * channel 'chrome' uses the Google Chrome already installed on the PC, so no browser download is needed
 * (Playwright's own Chromium download kept hanging on Mikkel's PC).
 * Test browsers are always headless and muted (e2e/launch.ts), so QA runs make no sound on Mikkel's PC.
 */
const launchOptions = mutedLaunch();
// /design-review previews run a second preview server (a worktree build) next to the main one, so the port can change.
const port = Number(process.env.QA_PORT ?? 4173);
const url = `http://localhost:${port}/mandarin-app/`;
export default defineConfig({
  testDir: 'qa',
  // The design-review specs only run through scripts/design-preview.ts (npm run design:shots / design:motion).
  testIgnore: process.env.DESIGN_REVIEW ? [] : ['**/design*.spec.ts'],
  timeout: 120_000,
  reporter: 'list',
  use: { baseURL: url, serviceWorkers: 'block', launchOptions },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, browserName: 'chromium', channel: 'chrome', launchOptions } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: 'chrome', launchOptions } },
  ],
});
