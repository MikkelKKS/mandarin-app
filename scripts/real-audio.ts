/**
 * Real speakers for words (IDEAS #20, CLAUDE.md §6 tier 2): human pronunciation
 * recordings of HSK words from Wikimedia Commons (mostly Lingua Libre), played
 * in the app before the Azure voice.
 *
 * - Only files whose licence allows reuse: CC0, public domain, CC BY, CC BY-SA
 *   (never NC/ND). Speaker, licence and source page are kept per file, and
 *   listed in public/audio/real/CREDITS.txt (linked from About).
 * - Only words of two or more characters, and only when one HSK word has those
 *   characters: single characters often have several readings (行 xíng/háng),
 *   and their real voices come from Tone Perfect instead (IDEAS #21).
 * - Clips are trimmed of leading/trailing silence, levelled to the loudness of
 *   the Azure recordings (−20 LUFS, peaks ≤ −2 dBFS), padded like them, and
 *   saved as 40 kbps mono MP3 in public/audio/real/<word id>.mp3.
 * - Index: content/data/real-audio.json. Idempotent: words already done (or
 *   skipped for a reason, or rejected after a "report bad audio") are left alone.
 *   A reported real clip is dropped by the Azure job (`--reports` in azure-tts.ts),
 *   so the Azure recording plays instead, and it's never fetched again.
 *
 *   npx tsx scripts/real-audio.ts --count     # coverage only, no downloads
 *   npx tsx scripts/real-audio.ts             # download what's missing
 *
 * Needs ffmpeg (on PATH, or the `ffmpeg-static` npm package installed with
 * `npm i --no-save ffmpeg-static`). Polite to Wikimedia: one request at a time.
 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'audio', 'real');
const INDEX = join(ROOT, 'content', 'data', 'real-audio.json');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'mandarin-app/1.0 (personal, non-commercial language-learning app; https://github.com/MikkelKKS/mandarin-app)';
const CATEGORIES = ['Category:Lingua Libre pronunciation-cmn', 'Category:Chinese pronunciation', 'Category:Mandarin pronunciation'];
const TARGET_LUFS = -20;
const MAX_PEAK = -2;

export interface RealClip {
  file: string;
  /** Commons file page. */
  source: string;
  speaker: string;
  licence: string;
  /** Seconds, after trimming. */
  dur: number;
}
export interface RealIndex {
  _about: string;
  words: Record<string, RealClip>;
  /** Words looked at and left out, with why (not retried). */
  skipped: Record<string, string>;
  /** Words whose real clip was reported as bad: never used again. */
  rejected: string[];
}

/** Pure: the Chinese text a pronunciation file says, from its title (null if it isn't one we can read). */
export function textOfTitle(title: string): string | null {
  const ll = /^File:LL-Q\d+ \(cmn\)-.+-([^-]+)\.\w+$/.exec(title);
  const zh = /^File:(?:Zh|Cmn|Zh-cn)[-_](.+?)\.\w+$/i.exec(title);
  const text = (ll?.[1] ?? zh?.[1])?.trim();
  return text && /^\p{Script=Han}+$/u.test(text) ? text : null;
}

/** Pure: is this licence open enough to reuse (no NonCommercial / NoDerivatives)? */
export function openLicence(name: string): boolean {
  const n = name.trim();
  if (/\bNC\b|\bND\b|non-?commercial|no-?deriv/i.test(n)) return false;
  return /^(CC0|Public domain|PD\b|CC[- ]BY(?:[- ]SA)?[- ]\d)/i.test(n);
}

/** Pure: plain text from Commons' HTML artist field. */
export function plainArtist(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || 'unknown';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function api(params: Record<string, string>): Promise<any> {
  const q = new URLSearchParams({ format: 'json', ...params });
  for (let i = 0; ; i++) {
    const res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } });
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      if (i >= 6) throw new Error(`Commons API: ${txt.slice(0, 100)}`);
      await sleep(15_000); // "too many requests": back off
    }
  }
}

async function members(cat: string): Promise<string[]> {
  const out: string[] = [];
  let cont: Record<string, string> = {};
  for (;;) {
    const r = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'file', ...cont });
    out.push(...r.query.categorymembers.map((m: { title: string }) => m.title));
    if (!r.continue) return out;
    cont = r.continue;
    await sleep(2000);
  }
}

interface Info { title: string; url: string; source: string; licence: string; speaker: string }
async function infos(titles: string[]): Promise<Map<string, Info>> {
  const out = new Map<string, Info>();
  for (let i = 0; i < titles.length; i += 50) {
    const r = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', titles: titles.slice(i, i + 50).join('|') });
    for (const p of Object.values<any>(r.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      out.set(p.title, { title: p.title, url: ii.url, source: ii.descriptionurl, licence: m.LicenseShortName?.value ?? '', speaker: plainArtist(m.Artist?.value ?? '') });
    }
    await sleep(2000);
  }
  return out;
}

/** Download a file, waiting and retrying when Wikimedia says "too many requests" (429/503). */
async function download(url: string): Promise<Buffer> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status !== 429 && res.status !== 503) || i >= 5) throw new Error(`HTTP ${res.status}`);
    const after = Number(res.headers.get('retry-after'));
    await sleep((after > 0 ? after : 15 * 2 ** i) * 1000);
  }
}

const run = promisify(execFile);
function ffmpegPath(): string {
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static') as string;
    if (p && existsSync(p)) return p;
  } catch {
    /* not installed: use the one on PATH */
  }
  return 'ffmpeg';
}
const FF = ffmpegPath();
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse';

/** Trim, level and pad one clip. Returns its trimmed length in seconds. */
async function convert(input: string, out: string): Promise<number> {
  const tmp = `${out}.tmp.wav`;
  await run(FF, ['-nostdin', '-y', '-loglevel', 'error', '-i', input, '-af', TRIM, '-ac', '1', '-ar', '24000', tmp]);
  const { stderr } = await run(FF, ['-nostdin', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1] ?? TARGET_LUFS);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1] ?? 0);
  const dur = Number(/time=(\d+):(\d+):([\d.]+)/.exec(stderr)?.slice(1).reduce((a, x, i) => a + Number(x) * [3600, 60, 1][i], 0) ?? 0);
  const gain = Math.min(TARGET_LUFS - lufs, MAX_PEAK - peak);
  // Padded with silence like the Azure clips, so browsers don't clip the start.
  await run(FF, ['-nostdin', '-y', '-loglevel', 'error', '-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,adelay=150,apad=pad_dur=0.3`, '-c:a', 'libmp3lame', '-b:a', '40k', out]);
  rmSync(tmp, { force: true });
  return dur;
}

async function main() {
  const countOnly = process.argv.includes('--count');
  const index: RealIndex = existsSync(INDEX)
    ? JSON.parse(readFileSync(INDEX, 'utf8'))
    : { _about: '', words: {}, skipped: {}, rejected: [] };
  index._about =
    'Human recordings of HSK words from Wikimedia Commons (mostly Lingua Libre), CC0/CC BY/CC BY-SA only, made by scripts/real-audio.ts. Played before the Azure voice (IDEAS #20). Credits: public/audio/real/CREDITS.txt.';
  const words = JSON.parse(readFileSync(join(ROOT, 'content', 'data', 'words.json'), 'utf8')) as Array<{ id: string; hanzi: string; level: number }>;
  const sameHanzi = new Map<string, number>();
  for (const w of words) sameHanzi.set(w.hanzi, (sameHanzi.get(w.hanzi) ?? 0) + 1);

  console.log('Listing Commons pronunciation files…');
  const byText = new Map<string, string[]>();
  for (const cat of CATEGORIES)
    for (const t of await members(cat)) {
      const x = textOfTitle(t);
      if (x) (byText.get(x) ?? byText.set(x, []).get(x)!).push(t);
    }
  // Lingua Libre first (newer, consistent recordings), then by title for stable picks.
  for (const list of byText.values()) list.sort((a, b) => Number(!a.startsWith('File:LL-')) - Number(!b.startsWith('File:LL-')) || a.localeCompare(b));

  const todo = words.filter(
    (w) => [...w.hanzi].length >= 2 && sameHanzi.get(w.hanzi) === 1 && byText.has(w.hanzi) && !index.words[w.id] && !index.skipped[w.id] && !index.rejected.includes(w.id),
  );
  console.log(`${byText.size} recorded texts; ${todo.length} words to look at (${Object.keys(index.words).length} done already).`);
  const meta = await infos(todo.flatMap((w) => byText.get(w.hanzi)!));
  const plan = todo.map((w) => ({ w, info: byText.get(w.hanzi)!.map((t) => meta.get(t)).find((i) => i && openLicence(i.licence)) }));
  for (const p of plan) if (!p.info) index.skipped[p.w.id] = 'no openly licensed recording';
  const go = plan.filter((p): p is { w: (typeof words)[number]; info: Info } => !!p.info);
  const perLevel: Record<number, number> = {};
  for (const p of go) perLevel[p.w.level] = (perLevel[p.w.level] ?? 0) + 1;
  console.log(`Openly licensed: ${go.length} words`, perLevel);
  if (countOnly) return;

  mkdirSync(OUT, { recursive: true });
  const dl = join(tmpdir(), 'mandarin-real-audio');
  mkdirSync(dl, { recursive: true });
  let n = 0;
  let failures = 0;
  for (const { w, info } of go) {
    try {
      const src = join(dl, `${w.id}${info.url.slice(info.url.lastIndexOf('.'))}`);
      writeFileSync(src, await download(info.url));
      failures = 0;
      const file = `${w.id}.mp3`;
      const dur = await convert(src, join(OUT, file));
      rmSync(src, { force: true });
      // Too short to be the word, or long enough to be something else.
      if (dur < 0.25 || dur > 4) {
        rmSync(join(OUT, file), { force: true });
        index.skipped[w.id] = `clip ${dur.toFixed(2)} s long`;
      } else index.words[w.id] = { file, source: info.source, speaker: info.speaker, licence: info.licence, dur: Math.round(dur * 100) / 100 };
    } catch (e) {
      console.warn(`${w.hanzi}: ${(e as Error).message}`);
      // Wikimedia keeps saying no: stop politely and resume another time (the run is idempotent).
      if (++failures >= 3) {
        console.warn('Three downloads in a row failed: stopping for now. Run the script again later to continue.');
        break;
      }
    }
    if (++n % 50 === 0) {
      console.log(`${n} / ${go.length}`);
      save(index);
    }
    await sleep(1500);
  }
  save(index);
  console.log(`Done: ${Object.keys(index.words).length} words with a real recording.`);
}

/**
 * A real clip was reported as bad ("Report bad audio"): drop it for good, so the
 * Azure recording plays instead. Returns false if the word has no real clip.
 * Used by the report step in scripts/azure-tts.ts.
 */
export function rejectReal(wordId: string): boolean {
  if (!existsSync(INDEX)) return false;
  const index = JSON.parse(readFileSync(INDEX, 'utf8')) as RealIndex;
  if (!index.words[wordId]) return false;
  delete index.words[wordId];
  index.rejected.push(wordId);
  rmSync(join(OUT, `${wordId}.mp3`), { force: true });
  save(index);
  return true;
}

function save(index: RealIndex) {
  const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(INDEX, JSON.stringify({ ...index, words: sorted(index.words), skipped: sorted(index.skipped), rejected: [...new Set(index.rejected)].sort() }, null, 1) + '\n');
  // Attribution for every file (CC BY / BY-SA ask for author, source and licence).
  const lines = Object.entries(index.words).map(([id, c]) => `${id}.mp3\t${c.speaker}\t${c.licence}\t${c.source}`);
  writeFileSync(
    join(OUT, 'CREDITS.txt'),
    `Real-speaker word recordings from Wikimedia Commons (mostly Lingua Libre), trimmed and loudness-levelled.\nfile\tspeaker\tlicence\tsource\n${lines.sort().join('\n')}\n`,
  );
}

if (process.argv[1]?.endsWith('real-audio.ts')) await main();
