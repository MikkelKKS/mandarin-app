/**
 * Generates audio with Azure Speech (CLAUDE.md §6). Run on GitHub (workflow
 * "azure-audio") or locally with a git-ignored .env containing
 * AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
 *
 *   npx tsx scripts/azure-tts.ts --sample             # the 30-item approval sample
 *   npx tsx scripts/azure-tts.ts --bulk [--minutes 330] [--dry-run]
 *
 * Bulk: every HSK word and example sentence in Xiaoxiao's voice (the owner's choice;
 * only lines a male character speaks in the course dialogues use Yunxi),
 * in learning order: each word followed by its example sentences, then the other
 * sentences, then the slow (0.7×) sentence versions. The free tier allows 20 requests
 * a minute, so a run stops after --minutes and the next run carries on.
 *
 * Idempotent: existing files are skipped. Every request's billed characters are
 * added to content/data/azure-usage.json, and the script stops before the
 * monthly free quota (it picks up where it left off the next month).
 */
import { allGrammarNotes } from '../src/lib/grammar';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  billedChars,
  monthKey,
  hintSpans,
  remaining,
  ssml,
  voiceBody,
  type HintFormat,
  type Usage,
  type VoiceKey,
} from './azure-tts-lib';
import { SAMPLE } from './azure-sample';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..');
const USAGE_FILE = join(ROOT, 'content', 'data', 'azure-usage.json');
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const AUDIO_DIR = join(ROOT, 'public', 'audio', 'az');
const MANIFEST_FILE = join(ROOT, 'content', 'data', 'azure-audio.json');
/** Items re-recorded after a report: their voice and full pronunciation, so bulk runs keep them. */
const OVERRIDES_FILE = join(ROOT, 'content', 'data', 'azure-overrides.json');
type Override = { voice: VoiceKey; all: true };
const loadOverrides = (): Record<string, Override> => (existsSync(OVERRIDES_FILE) ? JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')) : {});
/** Free tier: 20 requests per 60 seconds. */
const MIN_GAP_MS = 3_100;

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
let lastRequest = 0;

async function synth(env: { key: string; region: string }, usage: Usage, voice: VoiceKey, body: string): Promise<Buffer> {
  const cost = billedChars(body);
  if (remaining(usage, new Date()) < cost) throw new QuotaReached();
  const url = `https://${env.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
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
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = 5000 * 2 ** attempt;
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
      await synth(env, usage, 'f', voiceBody({ hanzi: '还书', hints: [{ start: 0, end: 2, phones: ['huan2', 'shu1'] }], format }));
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
  // The sample is small: always make it afresh, so voice or hint changes show up.
  rmSync(dir, { recursive: true, force: true });
  const format = await probeHintFormat(env, usage);
  const items = [];
  let made = 0;
  for (const it of SAMPLE) {
    const hints = hintSpans(it.hanzi, it.pinyin);
    const files: Record<string, string> = {};
    for (const voice of ['f', 'm'] as VoiceKey[]) {
      for (const slow of it.sentence ? [false, true] : [false]) {
        const name = `${voice}/${it.id}${slow ? '.slow' : ''}.mp3`;
        files[`${voice}${slow ? '-slow' : ''}`] = name;
        const file = join(dir, name);
        if (existsSync(file)) continue;
        write(file, await synth(env, usage, voice, voiceBody({ hanzi: it.hanzi, hints, format, slow })));
        made++;
      }
    }
    const chars = [...it.hanzi];
    items.push({ ...it, hint: hints.map((h) => `${chars.slice(h.start, h.end).join('')} ${h.phones.join(' ')}`).join(', ') || null, files });
  }
  writeFileSync(join(dir, 'items.json'), JSON.stringify({ voices: { f: 'Xiaoxiao', m: 'Yunxi' }, hintFormat: format, items }, null, 1) + '\n');
  console.log(`Sample: ${made} new file(s), ${SAMPLE.length} items.`);
}


interface Job {
  id: string;
  voice: VoiceKey;
  hanzi: string;
  pinyin: string;
  slow: boolean;
  /** Path relative to public/audio/az. */
  file: string;
}

function readList<T>(file: string, key: string): T[] {
  const raw = JSON.parse(readFileSync(join(ROOT, 'content', 'data', file), 'utf8'));
  return Array.isArray(raw) ? raw : raw[key];
}

/** Every clip, most useful first. */
/** Sentences only male characters speak in the course dialogues (米格, the male neighbour…). */
function maleLines(): Set<string> {
  const voices = new Map<string, Set<string>>();
  const dir = join(ROOT, 'content', 'units');
  for (const f of readdirSync(dir)) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8')).dialogue as
      | { speakers: Array<{ id: string; voice: string }>; lines: Array<{ speaker: string; sentence: string }> }
      | undefined;
    if (!d) continue;
    const sp = new Map(d.speakers.map((x) => [x.id, x.voice]));
    for (const l of d.lines) {
      const set = voices.get(l.sentence) ?? new Set<string>();
      set.add(sp.get(l.speaker) ?? 'f');
      voices.set(l.sentence, set);
    }
  }
  return new Set([...voices].filter(([, v]) => v.size === 1 && v.has('m')).map(([id]) => id));
}

/** Paragraphs of the Read stories (content/stories), as <story id>-p<n>. */
function storyParagraphs(): Array<{ id: string; hanzi: string }> {
  const dir = join(ROOT, 'content', 'stories');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const st = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { id: string; paragraphs: Array<{ zh: string }> };
      return st.paragraphs.map((p, i) => ({ id: `${st.id}-p${i}`, hanzi: p.zh }));
    });
}

function bulkJobs(): Job[] {
  const male = maleLines();
  const words = readList<{ id: string; hanzi: string; pinyin: string; order: number; examples: string[] }>('words.json', 'words').sort((a, b) => a.order - b.order);
  const sentences = readList<{ id: string; hanzi: string; pinyin: string; unlocks: number }>('sentences.json', 'sentences');
  const sById = new Map(sentences.map((x) => [x.id, x]));
  const normal: Job[] = [];
  const queued = new Set<string>();
  const addSentence = (id: string) => {
    const x = sById.get(id);
    if (!x || queued.has(id)) return;
    queued.add(id);
    normal.push({ id, voice: male.has(id) ? 'm' : 'f', hanzi: x.hanzi, pinyin: x.pinyin, slow: false, file: `${id}.mp3` });
  };
  // The Read stories, one clip per paragraph. 米格 tells them all (first person), so Yunxi.
  for (const st of storyParagraphs()) normal.push({ id: st.id, voice: 'm', hanzi: st.hanzi, pinyin: '', slow: false, file: `${st.id}.mp3` });
  // Grammar-note examples (content/grammar-notes.json).
  for (const g of allGrammarNotes()) normal.push({ id: g.id, voice: 'f', hanzi: g.zh, pinyin: g.py, slow: false, file: `${g.id}.mp3` });
  for (const w of words) {
    normal.push({ id: w.id, voice: 'f', hanzi: w.hanzi, pinyin: w.pinyin, slow: false, file: `${w.id}.mp3` });
    for (const e of w.examples) addSentence(e);
  }
  for (const x of [...sentences].sort((a, b) => a.unlocks - b.unlocks)) addSentence(x.id);
  // Slow (0.7×) versions of the sentences come last: they cost the most (the speed markup is billed).
  const slow = normal.filter((j) => queued.has(j.id)).map((j) => ({ ...j, slow: true, file: `${j.id}.slow.mp3` }));
  return [...normal, ...slow];
}

/** Fingerprint of what a clip was made from, so edited text gets re-recorded. */
function fingerprint(voice: VoiceKey, body: string): string {
  return createHash('sha1').update(`${voice}|${body}`).digest('hex').slice(0, 10);
}

async function bulk(env: { key: string; region: string } | null, usage: Usage, minutes: number): Promise<void> {
  const stopAt = Date.now() + minutes * 60_000;
  const manifest: Record<string, string> = existsSync(MANIFEST_FILE) ? JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) : {};
  const format = env ? await probeHintFormat(env, usage) : (usage.hintFormat ?? 'spaced');
  const jobs = bulkJobs();
  const overrides = loadOverrides();
  for (const j of jobs) {
    const o = overrides[j.id];
    if (o) j.voice = o.voice;
  }
  const todo = jobs
    .map((j) => ({ j, body: voiceBody({ hanzi: j.hanzi, hints: hintSpans(j.hanzi, j.pinyin, { all: !!overrides[j.id] }), format, slow: j.slow }) }))
    .filter(({ j, body }) => !(manifest[j.file] === fingerprint(j.voice, body) && existsSync(join(AUDIO_DIR, j.file))));
  const cost = todo.reduce((n, t) => n + billedChars(t.body), 0);
  console.log(`${jobs.length} clips in all, ${todo.length} to make (${cost} billed characters). Free this month: ${Math.max(0, remaining(usage, new Date()))}.`);
  if (!env) return; // dry run
  let made = 0;
  const save = () => {
    writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, Object.keys(manifest).sort(), 0) + '\n');
    saveUsage(usage);
  };
  try {
    for (const { j, body } of todo) {
      if (Date.now() > stopAt) {
        console.log(`Time's up for this run; the next run carries on.`);
        break;
      }
      try {
        write(join(AUDIO_DIR, j.file), await synth(env, usage, j.voice, body));
        manifest[j.file] = fingerprint(j.voice, body);
        made++;
      } catch (e) {
        if (e instanceof QuotaReached) throw e;
        console.warn(`${j.file} (${j.hanzi}): ${(e as Error).message}`);
      }
      if (made % 200 === 0) save();
    }
  } finally {
    save();
    const left = todo.length - made;
    console.log(`::notice::Made ${made} clip(s); ${left} left.`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      writeFileSync(process.env.GITHUB_STEP_SUMMARY, `Made ${made} clip(s), ${left} left of ${jobs.length}.\n`, { flag: 'a' });
    }
  }
}

/**
 * Re-record items reported as sounding wrong (the app's "Report bad audio").
 * First report: Xiaoxiao again with every word's pronunciation spelled out.
 * Reported again: the other voice (Yunxi). Reads and updates the Supabase
 * audio_reports table with the service key (GitHub secret SUPABASE_SERVICE_KEY).
 */
async function reports(env: { key: string; region: string }, usage: Usage): Promise<void> {
  // The project URL is public: it's in .env.production next to the anon key.
  const prod = existsSync(join(ROOT, '.env.production')) ? readFileSync(join(ROOT, '.env.production'), 'utf8') : '';
  const url = (process.env.SUPABASE_URL ?? prod.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1])?.trim().replace(/\/$/, '');
  const service = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !service) {
    console.log('Reports: SUPABASE_URL / SUPABASE_SERVICE_KEY not set, skipped.');
    return;
  }
  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${url}/rest/v1/audio_reports?select=user_id,id,data`, { headers });
  if (!res.ok) {
    console.log(`::warning::Reports: couldn't read the audio_reports table (HTTP ${res.status}); has 002_audio_reports.sql been run, and is SUPABASE_SERVICE_KEY right?`);
    return;
  }
  const rows = (await res.json()) as Array<{ user_id: string; id: string; data: { status: string; count: number; hanzi: string } }>;
  const open = rows.filter((r) => r.data?.status === 'open');
  console.log(`::notice::Reports: table reachable, ${open.length} open of ${rows.length}.`);
  if (!open.length) return;

  const words = readList<{ id: string; hanzi: string; pinyin: string; legacy?: string[] }>('words.json', 'words');
  const sentences = readList<{ id: string; hanzi: string; pinyin: string }>('sentences.json', 'sentences');
  const byId = new Map<string, { id: string; hanzi: string; pinyin: string; sentence: boolean }>();
  for (const w of words) {
    byId.set(w.id, { ...w, sentence: false });
    for (const l of w.legacy ?? []) byId.set(l, { ...w, sentence: false });
  }
  for (const x of sentences) byId.set(x.id, { ...x, sentence: true });

  const format = await probeHintFormat(env, usage);
  const manifest: Record<string, string> = existsSync(MANIFEST_FILE) ? JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) : {};
  const overrides = loadOverrides();
  for (const r of open) {
    const it = byId.get(r.id);
    if (!it) {
      console.warn(`Report for unknown item ${r.id} (${r.data.hanzi}): skipped.`);
      continue;
    }
    const voice: VoiceKey = (r.data.count ?? 1) >= 2 ? 'm' : 'f';
    const hints = hintSpans(it.hanzi, it.pinyin, { all: true });
    const files = [{ file: `${it.id}.mp3`, slow: false }];
    if (it.sentence && existsSync(join(AUDIO_DIR, `${it.id}.slow.mp3`))) files.push({ file: `${it.id}.slow.mp3`, slow: true });
    for (const f of files) {
      const body = voiceBody({ hanzi: it.hanzi, hints, format, slow: f.slow });
      write(join(AUDIO_DIR, f.file), await synth(env, usage, voice, body));
      manifest[f.file] = fingerprint(voice, body);
    }
    overrides[it.id] = { voice, all: true };
    const now = Date.now();
    const patch = await fetch(`${url}/rest/v1/audio_reports?user_id=eq.${r.user_id}&id=eq.${encodeURIComponent(r.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data: { ...r.data, status: 'fixed', fixedAt: now, updatedAt: now }, updated_at: now }),
    });
    console.log(`Re-recorded ${it.hanzi} (${voice === 'm' ? 'Yunxi' : 'Xiaoxiao, spelled out'})${patch.ok ? '' : `; couldn't mark it fixed (HTTP ${patch.status})`}.`);
  }
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, Object.keys(manifest).sort(), 0) + '\n');
  writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 1) + '\n');
  saveUsage(usage);
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const env = dry ? null : loadEnv();
  const usage = loadUsage();
  const before = usage.months[monthKey(new Date())] ?? 0;
  const mi = process.argv.indexOf('--minutes');
  const minutes = mi > 0 ? Number(process.argv[mi + 1]) : 330;
  try {
    if (process.argv.includes('--sample') && env) await sample(env, usage);
    else if (process.argv.includes('--bulk')) {
      // Reported recordings first (quick), then carry on with the bulk.
      if (env) await reports(env, usage);
      await bulk(env, usage, minutes);
    } else if (process.argv.includes('--reports') && env) await reports(env, usage);
    else {
      console.error('Usage: npx tsx scripts/azure-tts.ts --sample | --bulk [--minutes 330] [--dry-run]');
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
