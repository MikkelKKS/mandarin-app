import { defineConfig, devices } from '@playwright/test';

const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
import { existsSync } from 'node:fs';
import { mutedLaunch } from './e2e/launch';
// Test browsers are always headless and muted (e2e/launch.ts), so test runs make no sound on Mikkel's PC.
const launchOptions = { ...mutedLaunch(), ...(!process.env.CI && existsSync(local) ? { executablePath: local } : {}) };
// On Mikkel's PC (no CI, no sandbox browser) use the installed Google Chrome, as the QA tour does:
// Playwright's own Chromium download hangs there.
const chrome = !process.env.CI && !existsSync(local) ? { channel: 'chrome' } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/mandarin-app/', launchOptions },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/mandarin-app/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 760 }, browserName: 'chromium', ...chrome, launchOptions } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...chrome, launchOptions } },
  ],
});
