import { defineConfig, devices } from '@playwright/test';

/**
 * QA screen tour (used by the qa agent, not by CI).
 * Run: npm run build && npx playwright test -c playwright.qa.config.ts
 * Screenshots land in qa-screenshots/ (git-ignored).
 * channel 'chrome' uses the Google Chrome already installed on the PC, so no browser download is needed
 * (Playwright's own Chromium download kept hanging on Mikkel's PC).
 */
export default defineConfig({
  testDir: 'qa',
  timeout: 120_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/mandarin-app/', serviceWorkers: 'block' },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/mandarin-app/',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, browserName: 'chromium', channel: 'chrome' } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: 'chrome' } },
  ],
});
