/**
 * The one place test browsers get their launch options: always headless and
 * always muted (--mute-audio), so test runs make no sound on Mikkel's PC.
 * The app also silences itself when navigator.webdriver is true (src/lib/automated.ts).
 *
 * - Configs and specs: `launchOptions: mutedLaunch(...extraArgs)` (never a bare launchOptions object).
 * - Node scripts: `await launchMuted()` instead of calling chromium.launch() directly.
 */
import { chromium, type LaunchOptions } from '@playwright/test';

export const MUTED_ARGS = ['--mute-audio'];

export function mutedLaunch(...extraArgs: string[]): LaunchOptions & { headless: true; args: string[] } {
  return { headless: true, args: [...MUTED_ARGS, ...extraArgs] };
}

/** For stand-alone scripts. Uses the installed Google Chrome (Playwright's own download hangs on Mikkel's PC). */
export function launchMuted(opts: LaunchOptions = {}) {
  return chromium.launch({ channel: 'chrome', ...opts, ...mutedLaunch(...(opts.args ?? [])) });
}
