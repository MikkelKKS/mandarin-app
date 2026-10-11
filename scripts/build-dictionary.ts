/**
 * Builds the in-app dictionary from CC-CEDICT (CC BY-SA 4.0 —
 * https://www.mdbg.net/chinese/dictionary?page=cc-cedict). The data is
 * downloaded, never typed by hand, and written to public/dict/cedict.tsv
 * (not committed; generated in CI).
 *
 *   npm run dict:build                    # download from MDBG
 *   npm run dict:build -- --from <file>   # use a local .txt or .txt.gz
 *
 * Output line format (tab-separated):
 *   simplified  pinyin-with-marks  toneless-key  definitions(" / "-joined)  hsk-level(0 = none)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { markSyllable, type Tone } from '../src/lib/pinyin';

const URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const root = join(import.meta.dirname, '..');
const outDir = join(root, 'public', 'dict');
const fromIdx = process.argv.indexOf('--from');
const fromFile = fromIdx > 0 ? process.argv[fromIdx + 1] : undefined;

/** "ni3 hao3" → "nǐ hǎo"; keeps capitals for names; "lu:4" → "lǜ". */
export function cedictPinyin(numeric: string): string {
  return numeric
    .split(' ')
    .map((tok) => {
      const m = tok.match(/^([A-Za-z:]+)([1-5])$/);
      if (!m) return tok;
      const base = m[1].toLowerCase().replace(/u:/g, 'v');
      let marked = markSyllable({ base, tone: Number(m[2]) as Tone });
      if (/^[A-Z]/.test(m[1])) marked = marked[0].toUpperCase() + marked.slice(1);
      return marked;
    })
    .join(' ');
}

export function tonelessKey(numeric: string): string {
  return numeric.toLowerCase().replace(/u:/g, 'v').replace(/[^a-z]/g, '');
}

const VARIANT = /^(old |archaic |erhua |japanese )?variant of /i;

export function parseCedict(text: string, hsk: Map<string, number>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/);
    if (!m) continue;
    const [, , simp, py, defsRaw] = m;
    if (!/^[\p{Script=Han}]+$/u.test(simp)) continue; // skip "11区", "AA制" etc.
    const defs = defsRaw.split('/').filter((d) => d && !VARIANT.test(d));
    if (!defs.length) continue;
    const key = `${simp}|${py}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const clean = (s: string) => s.replace(/[\t\n]/g, ' ');
    out.push([simp, cedictPinyin(py), tonelessKey(py), clean(defs.join(' / ')), String(hsk.get(simp) ?? 0)].join('\t'));
  }
  return out;
}

async function main() {
  let buf: Buffer;
  if (fromFile) buf = readFileSync(fromFile);
  else {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  const text = (fromFile && !fromFile.endsWith('.gz') ? buf : gunzipSync(buf)).toString('utf8');
  const hskFile = join(root, 'content/hsk/hsk-levels.json');
  const hsk = new Map<string, number>();
  if (existsSync(hskFile)) {
    for (const w of JSON.parse(readFileSync(hskFile, 'utf8')).words as Array<{ h: string; l: number }>) if (!hsk.has(w.h)) hsk.set(w.h, w.l);
  }
  const lines = parseCedict(text, hsk);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'cedict.tsv'), lines.join('\n') + '\n');
  console.log(`Wrote ${lines.length} dictionary entries to public/dict/cedict.tsv`);
}

if (process.argv[1]?.endsWith('build-dictionary.ts')) {
  main().catch((e) => {
    // Never break the deploy over the dictionary: the app shows a friendly message instead.
    console.warn(`Dictionary download failed (${(e as Error).message}); the app will run without it.`);
    process.exit(0);
  });
}
