import { defineConfig, devices } from '@playwright/test';

const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
import { existsSync } from 'node:fs';
const launchOptions = !process.env.CI && existsSync(local) ? { executablePath: local } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/mandarin-app/', launchOptions },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/mandarin-app/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 760 }, browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
