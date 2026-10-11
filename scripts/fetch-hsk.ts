/**
 * Downloads the HSK 2.0 (levels 1–6) vocabulary from the open
 * drkameleon/complete-hsk-vocabulary repo (MIT licence —
 * https://github.com/drkameleon/complete-hsk-vocabulary) and writes a compact
 * index to content/hsk/hsk-levels.json, used to check/assign HSK levels.
 *
 *   npm run hsk:fetch                    # download from GitHub
 *   npm run hsk:fetch -- --from <dir>    # use a local clone instead
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/old';
const fromIdx = process.argv.indexOf('--from');
const fromDir = fromIdx > 0 ? process.argv[fromIdx + 1] : undefined;

interface SourceEntry {
  simplified: string;
  forms: Array<{ transcriptions: { pinyin: string; numeric: string }; meanings: string[] }>;
}

async function load(level: number): Promise<SourceEntry[]> {
  if (fromDir) return JSON.parse(readFileSync(join(fromDir, 'wordlists/exclusive/old', `${level}.json`), 'utf8'));
  const res = await fetch(`${BASE}/${level}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for level ${level}`);
  return (await res.json()) as SourceEntry[];
}

const out: Array<{ h: string; p: string; l: number; e: string }> = [];
for (const level of [1, 2, 3, 4, 5, 6]) {
  for (const entry of await load(level)) {
    const form = entry.forms[0];
    out.push({ h: entry.simplified, p: form.transcriptions.pinyin, l: level, e: form.meanings[0] ?? '' });
  }
}
const dir = join(import.meta.dirname, '..', 'content', 'hsk');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, 'hsk-levels.json'),
  JSON.stringify({ source: 'https://github.com/drkameleon/complete-hsk-vocabulary (MIT)', words: out }) + '\n',
);
console.log(`Wrote ${out.length} entries (HSK 1–6) to content/hsk/hsk-levels.json`);
