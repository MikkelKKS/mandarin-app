/**
 * Generates audio with Azure Speech (CLAUDE.md §6). Run on GitHub (workflow
 * "azure-audio") or locally with a git-ignored .env containing
 * AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
 *
 *   npx tsx scripts/azure-tts.ts --sample   # the 30-item approval sample
 *
 * Idempotent: existing files are skipped. Every request's billed characters are
 * added to content/data/azure-usage.json, and the script stops before the
 * monthly free quota (it picks up where it left off the next month).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  billedChars,
  monthKey,
  needsHint,
  remaining,
  ssml,
  voiceBody,
  type HintFormat,
  type Usage,
  type VoiceKey,
} from './azure-tts-lib';
import { SAMPLE } from './azure-sample';

const ROOT = join(import.meta.dirname, '..');
const USAGE_FILE = join(ROOT, 'content', 'data', 'azure-usage.json');
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

function loadEnv(): { key: string; region: string } {
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    console.error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set (GitHub secrets, or a .env file in the repo folder).');
    process.exit(2);
  }
  return { key, region };
}

function loadUsage(): Usage {
  return existsSync(USAGE_FILE) ? JSON.parse(readFileSync(USAGE_FILE, 'utf8')) : { months: {} };
}
function saveUsage(u: Usage): void {
  writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2) + '\n');
}

class QuotaReached extends Error {}

async function synth(env: { key: string; region: string }, usage: Usage, voice: VoiceKey, body: string): Promise<Buffer> {
  const cost = billedChars(body);
  if (remaining(usage, new Date()) < cost) throw new QuotaReached();
  const url = `https://${env.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': FORMAT,
        'User-Agent': 'mandarin-app-audio',
      },
      body: ssml(voice, body),
    });
    // Billed when processed, so count it as soon as Azure answers.
    if (res.ok || res.status === 400) {
      const m = monthKey(new Date());
      usage.months[m] = (usage.months[m] ?? 0) + cost;
    }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`Azure returned almost no audio (${buf.length} bytes)`);
      return buf;
    }
    if (res.status === 401 || res.status === 403) {
      console.error(`Azure refused the key (HTTP ${res.status}). Check the AZURE_SPEECH_KEY secret and that the region is ${env.region}.`);
      process.exit(3);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`HTTP ${res.status}, retrying in ${wait / 1000} s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/** Find out which pronunciation-hint format Azure accepts (once; remembered in the usage file). */
async function probeHintFormat(env: { key: string; region: string }, usage: Usage): Promise<HintFormat> {
  if (usage.hintFormat) return usage.hintFormat;
  for (const format of ['spaced', 'joined'] as HintFormat[]) {
    try {
      await synth(env, usage, 'f', voiceBody({ hanzi: '还书', hint: ['huan2', 'shu1'], format }));
      console.log(`Pronunciation hints: Azure accepts the "${format}" format.`);
      usage.hintFormat = format;
      saveUsage(usage);
      return format;
    } catch (e) {
      if (e instanceof QuotaReached) throw e;
      console.warn(`Hint format "${format}" refused: ${(e as Error).message}`);
    }
  }
  throw new Error('Azure accepted neither pronunciation-hint format.');
}

function write(file: string, buf: Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
}

async function sample(env: { key: string; region: string }, usage: Usage): Promise<void> {
  const dir = join(ROOT, 'public', 'audio-sample');
  const format = await probeHintFormat(env, usage);
  const items = [];
  let made = 0;
  for (const it of SAMPLE) {
    const hint = needsHint(it.hanzi, it.pinyin);
    const files: Record<string, string> = {};
    for (const voice of ['f', 'm'] as VoiceKey[]) {
      for (const slow of it.sentence ? [false, true] : [false]) {
        const name = `${voice}/${it.id}${slow ? '.slow' : ''}.mp3`;
        files[`${voice}${slow ? '-slow' : ''}`] = name;
        const file = join(dir, name);
        if (existsSync(file)) continue;
        write(file, await synth(env, usage, voice, voiceBody({ hanzi: it.hanzi, hint, format, slow })));
        made++;
      }
    }
    items.push({ ...it, hint: hint?.join(' ') ?? null, files });
  }
  writeFileSync(join(dir, 'items.json'), JSON.stringify({ voices: { f: 'Xiaoxiao', m: 'Yunjian' }, hintFormat: format, items }, null, 1) + '\n');
  console.log(`Sample: ${made} new file(s), ${SAMPLE.length} items.`);
}

async function main() {
  const env = loadEnv();
  const usage = loadUsage();
  const before = usage.months[monthKey(new Date())] ?? 0;
  try {
    if (process.argv.includes('--sample')) await sample(env, usage);
    else {
      console.error('Usage: npx tsx scripts/azure-tts.ts --sample');
      process.exit(1);
    }
  } catch (e) {
    if (e instanceof QuotaReached) console.log("Stopped before this month's free quota. Run again next month to continue.");
    else throw e;
  } finally {
    saveUsage(usage);
    const now = usage.months[monthKey(new Date())] ?? 0;
    console.log(`Billed characters this run: ${now - before}. This month: ${now} of 500,000 (free tier).`);
  }
}

await main();
