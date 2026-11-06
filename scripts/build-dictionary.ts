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
 *
 * Also writes public/dict/t2s.json: traditional → simplified for single
 * characters, so song lyrics in traditional characters can be read and scored.
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

/** Traditional → simplified character pairs from single-character entries. */
export function tradToSimp(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S+) (\S+) \[/);
    if (!m) continue;
    const [, trad, simp] = m;
    if (trad === simp || [...trad].length !== 1 || [...simp].length !== 1) continue;
    if (!/\p{Script=Han}/u.test(trad) || map[trad]) continue;
    map[trad] = simp;
  }
  return map;
}

const normPy = (p: string) => p.toLowerCase().replace(/[\s'·-]/g, '');

/**
 * `readingLevels`: the HSK level of each reading of a word (characters → pinyin → level, from
 * content/data/words.json). When one of a word's CEDICT readings is listed there, each reading
 * gets its own level and unlisted ones get none (说 shuō is HSK 1, 说 shuì is not), so the app
 * ranks the common reading of a polyphone first. Otherwise `hsk` (per word) is used.
 */
export function parseCedict(text: string, hsk: Map<string, number>, readingLevels = new Map<string, Map<string, number>>()): string[] {
  const out: string[] = [];
  const readings = new Map<string, string[]>(); // simp → its CEDICT readings (normalised)
  for (const line of text.split('\n')) {
    const m = line.match(/^\S+ (\S+) \[([^\]]*)\] \//);
    if (m) readings.set(m[1], [...(readings.get(m[1]) ?? []), normPy(cedictPinyin(m[2]))]);
  }
  const level = (simp: string, marked: string) => {
    const lv = readingLevels.get(simp);
    if (lv && readings.get(simp)?.some((r) => lv.has(r))) return lv.get(normPy(marked)) ?? 0;
    return hsk.get(simp) ?? 0;
  };
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
    out.push([simp, cedictPinyin(py), tonelessKey(py), clean(defs.join(' / ')), String(level(simp, cedictPinyin(py)))].join('\t'));
  }
  return out;
}

/** Downloads (or reads `from`) CC-CEDICT and writes public/dict. Also used by scripts/ensure-dictionary.ts. */
export async function buildDictionary(from = fromFile) {
  let buf: Buffer;
  if (from) buf = readFileSync(from);
  else {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  const text = (from && !from.endsWith('.gz') ? buf : gunzipSync(buf)).toString('utf8');
  const hskFile = join(root, 'content/hsk/hsk-levels.json');
  const hsk = new Map<string, number>();
  if (existsSync(hskFile)) {
    for (const w of JSON.parse(readFileSync(hskFile, 'utf8')).words as Array<{ h: string; l: number }>) if (!hsk.has(w.h)) hsk.set(w.h, w.l);
  }
  // Per-reading HSK levels from the course's word list (看 kàn is HSK 1, kān is HSK 6).
  const readingLevels = new Map<string, Map<string, number>>();
  const wordsFile = join(root, 'content/data/words.json');
  if (existsSync(wordsFile)) {
    const raw = JSON.parse(readFileSync(wordsFile, 'utf8'));
    for (const w of (raw.words ?? raw) as Array<{ hanzi: string; pinyin: string; level: number }>) {
      const lv = readingLevels.get(w.hanzi) ?? new Map<string, number>();
      const key = normPy(w.pinyin);
      if (!lv.has(key) || w.level < lv.get(key)!) lv.set(key, w.level);
      readingLevels.set(w.hanzi, lv);
    }
  }
  const lines = parseCedict(text, hsk, readingLevels);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'cedict.tsv'), lines.join('\n') + '\n');
  const t2s = tradToSimp(text);
  writeFileSync(join(outDir, 't2s.json'), JSON.stringify(t2s));
  console.log(`Wrote ${lines.length} dictionary entries to public/dict/cedict.tsv, ${Object.keys(t2s).length} traditional characters to t2s.json`);
}

if (process.argv[1]?.endsWith('build-dictionary.ts')) {
  buildDictionary().catch((e) => {
    // Never break the deploy over the dictionary: the app shows a friendly message instead.
    console.warn(`Dictionary download failed (${(e as Error).message}); the app will run without it.`);
    process.exit(0);
  });
}
