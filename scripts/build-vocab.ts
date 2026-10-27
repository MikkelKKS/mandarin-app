/**
 * Builds the big vocabulary from open data. Nothing here is typed by hand:
 *
 *   - HSK 3.0 word list: ivankra/hsk30 (MIT) — https://github.com/ivankra/hsk30
 *   - Frequency ranks and classifiers: drkameleon/complete-hsk-vocabulary (MIT)
 *     — https://github.com/drkameleon/complete-hsk-vocabulary
 *   - English glosses: CC-CEDICT (CC BY-SA 4.0) — https://www.mdbg.net/chinese/dictionary?page=cc-cedict
 *   - Example sentences: Tatoeba (CC BY 2.0 FR) — https://tatoeba.org
 *   - The hand-written course units in content/units (their words and sentences)
 *
 * Writes content/data/words.json, content/data/sentences.json and content/data/REPORT.md.
 * Ids are derived from the characters and the reading, so they stay the same between runs.
 *
 *   npm run vocab:build -- --hsk30 <dir> --drk <dir> [--cedict <file.txt[.gz]>] [--tatoeba <dir>]
 *
 * The Tatoeba directory holds cmn.tsv and eng.tsv (id, lang, text, username, …)
 * and links.tsv (cmn id, eng id). scripts/fetch-vocab-sources.sh prepares all of it;
 * the "data" GitHub workflow runs both and commits the result.
 * Without --cedict the glosses come from drkameleon; without --tatoeba only course sentences are used.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';
import { alignToHanzi, hanziOnly, isHanzi } from '../src/lib/pinyin';
import {
  VocabSentenceSchema,
  VocabWordSchema,
  classifiersFrom,
  cleanGlosses,
  numericToMarks,
  sentencePinyin,
  tokenize,
  wordId,
  type VocabSentence,
  type VocabWord,
} from '../src/content/vocab';

const root = join(import.meta.dirname, '..');
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const hsk30Dir = arg('hsk30');
const drkDir = arg('drk');
const cedictFile = arg('cedict');
const tatoebaDir = arg('tatoeba');
const outDir = arg('out') ?? join(root, 'content', 'data');
if (!hsk30Dir || !drkDir) {
  console.error('Usage: npm run vocab:build -- --hsk30 <dir> --drk <dir> [--cedict <file>] [--tatoeba <dir>]');
  process.exit(1);
}

// ---------- small CSV reader (quoted fields, commas, doubled quotes) ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

// ---------- CC-CEDICT ----------
interface CedictEntry {
  trad: string;
  simp: string;
  numeric: string;
  defs: string[];
}
const cedictByKey = new Map<string, CedictEntry>();
const tradOnly = new Set<string>();
if (cedictFile) {
  const raw = readFileSync(cedictFile);
  const text = (cedictFile.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
  const simpChars = new Set<string>();
  const tradChars = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/);
    if (!m) continue;
    const e: CedictEntry = { trad: m[1], simp: m[2], numeric: m[3], defs: m[4].split('/') };
    const key = `${e.trad}|${e.simp}[${e.numeric}]`;
    const prev = cedictByKey.get(key);
    if (prev) prev.defs.push(...e.defs);
    else cedictByKey.set(key, e);
    const t = [...e.trad];
    const s = [...e.simp];
    if (t.length === s.length) t.forEach((c, i) => c !== s[i] && tradChars.add(c));
    s.forEach((c) => simpChars.add(c));
  }
  for (const c of tradChars) if (!simpChars.has(c)) tradOnly.add(c);
  console.log(`CC-CEDICT: ${cedictByKey.size} entries, ${tradOnly.size} traditional-only characters`);
}

// ---------- drkameleon: frequency, classifiers, fallback glosses ----------
interface DrkEntry {
  simplified: string;
  frequency?: number;
  forms: Array<{ traditional: string; transcriptions: { numeric: string }; meanings: string[]; classifiers: string[] }>;
}
const drk = JSON.parse(readFileSync(join(drkDir, 'complete.json'), 'utf8')) as DrkEntry[];
const drkBySimp = new Map(drk.map((d) => [d.simplified, d]));
const normNum = (n: string) => n.toLowerCase().replace(/u:/g, 'v').replace(/\s+/g, ' ').trim();

// ---------- HSK 3.0 ----------
interface Draft {
  hanzi: string;
  trad?: string;
  numeric: string;
  level: number;
  hsk?: string;
  pos: string[];
  gloss: string[];
  classifiers: string[];
  freq?: number;
  legacy: string[];
}
const drafts = new Map<string, Draft>(); // by word id
const problems: string[] = [];

/**
 * Tone marks to dictionary tone numbers, aligned with the characters:
 * "bàba" + 爸爸 → "ba4 ba5", "hǎowánr" + 好玩儿 → "hao3 wan2 r5".
 * Spoken tone changes are undone (一 yí/yì → yi1, 不 bú → bu4), and a capital
 * (names such as Dānmài) is kept on the first syllable, as CC-CEDICT does.
 */
function marksToNumeric(pinyin: string, hanzi: string): string | null {
  const a = alignToHanzi(hanzi, pinyin.replace(/-/g, ' '));
  if (!a) return null;
  const parts = a.syls.map((x, si) => {
    const ch = a.chars[a.charSyl.indexOf(si)];
    let tone = x.tone;
    if (ch === '一' && x.base === 'yi' && (tone === 2 || tone === 4)) tone = 1;
    if (ch === '不' && x.base === 'bu' && tone === 2) tone = 4;
    return x.erhua ? `${x.base}${tone} r5` : `${x.base}${tone}`;
  });
  if (/^\s*[A-ZĀÁǍÀĒÉĚÈŌÓǑÒ]/.test(pinyin)) parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.join(' ');
}

const POS: Record<string, string> = {
  N: 'noun', V: 'verb', Adj: 'adjective', Adv: 'adverb', Pron: 'pronoun', Num: 'numeral', M: 'measure word',
  Prep: 'preposition', Conj: 'conjunction', Aux: 'particle', Int: 'interjection', Prefix: 'prefix', Suffix: 'suffix', Phonetic: 'sound word',
};

const rows = parseCsv(readFileSync(join(hsk30Dir, 'hsk30-expanded.csv'), 'utf8'));
const head = rows.shift()!;
const col = (name: string) => head.indexOf(name);
for (const r of rows) {
  const hanzi = r[col('Simplified')].trim();
  if (!hanzi || [...hanzi].some((c) => !isHanzi(c))) {
    problems.push(`HSK ${r[col('ID')]}: skipped "${hanzi}" (not plain characters)`);
    continue;
  }
  const keys = r[col('CEDICT')].split('/').filter(Boolean);
  const entries = keys.map((k) => cedictByKey.get(k)).filter((e): e is CedictEntry => !!e);
  const keyNumeric = keys[0]?.match(/\[([^\]]+)\]/)?.[1];
  const numeric = keyNumeric ?? marksToNumeric(r[col('Pinyin')], hanzi);
  if (!numeric) {
    problems.push(`HSK ${r[col('ID')]} ${hanzi}: could not read the pinyin "${r[col('Pinyin')]}"`);
    continue;
  }
  const id = wordId(hanzi, numeric);
  if (drafts.has(id)) continue; // same word listed twice (e.g. a traditional variant row)
  const d = drkBySimp.get(hanzi);
  const form = d?.forms.find((f) => normNum(f.transcriptions.numeric) === normNum(numeric)) ?? d?.forms[0];
  const defs = entries.flatMap((e) => e.defs);
  const level = r[col('Level')] === '7-9' ? 7 : Number(r[col('Level')]);
  const trad = r[col('Traditional')].split('|')[0];
  drafts.set(id, {
    hanzi,
    trad: trad && trad !== hanzi ? trad : undefined,
    numeric,
    level,
    hsk: r[col('ID')],
    pos: r[col('POS')].split('/').map((p) => POS[p] ?? p.toLowerCase()).filter(Boolean),
    gloss: cleanGlosses(defs.length ? defs : (form?.meanings ?? [])),
    classifiers: defs.length ? classifiersFrom(defs) : (form?.classifiers ?? []).map((c) => c.split('|').pop()!.replace(/\[.*/, '')),
    freq: d?.frequency && d.frequency < 1_000_000 ? d.frequency : undefined,
    legacy: [],
  });
}
console.log(`HSK 3.0: ${drafts.size} words`);

// ---------- the hand-written course ----------
interface UnitWord {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string[];
  pos?: string;
}
interface UnitSentence {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  words: string[];
  alt?: { english?: string[] };
}
const unitFiles = readdirSync(join(root, 'content', 'units')).filter((f) => f.endsWith('.json')).sort();
const units = unitFiles.map((f) => JSON.parse(readFileSync(join(root, 'content', 'units', f), 'utf8')) as { words: UnitWord[]; sentences: UnitSentence[] });
const legacyToNew = new Map<string, string>();
const toneless = (n: string) => normNum(n).replace(/[1-5]/g, '');
for (const u of units) {
  for (const w of u.words) {
    const numeric = marksToNumeric(w.pinyin, w.hanzi);
    // Match the same characters and reading; then the same characters with a different tone (e.g. 一 written with sandhi).
    let match = numeric ? drafts.get(wordId(w.hanzi, numeric)) : undefined;
    let matchId = match && numeric ? wordId(w.hanzi, numeric) : undefined;
    if (!match && numeric) {
      for (const [id, d] of drafts)
        if (d.hanzi === w.hanzi && toneless(d.numeric) === toneless(numeric)) {
          match = d;
          matchId = id;
          break;
        }
    }
    if (match && matchId) {
      match.legacy.push(w.id);
      legacyToNew.set(w.id, matchId);
      continue;
    }
    if (!numeric || [...w.hanzi].some((c) => !isHanzi(c))) {
      problems.push(`Course word ${w.id} "${w.hanzi}" kept out: could not read its pinyin`);
      continue;
    }
    const id = wordId(w.hanzi, numeric);
    const existing = drafts.get(id);
    if (existing) {
      existing.legacy.push(w.id);
      legacyToNew.set(w.id, id);
      continue;
    }
    drafts.set(id, { hanzi: w.hanzi, numeric, level: 0, pos: w.pos ? [w.pos] : [], gloss: w.english.slice(0, 4), classifiers: [], legacy: [w.id] });
    legacyToNew.set(w.id, id);
  }
}

// ---------- learning order: level 1..7 by frequency, course-only words last ----------
const ordered = [...drafts.entries()].sort(([, a], [, b]) => {
  const la = a.level || 99;
  const lb = b.level || 99;
  if (la !== lb) return la - lb;
  return (a.freq ?? 1e9) - (b.freq ?? 1e9) || (a.hsk ?? '').localeCompare(b.hsk ?? '') || a.hanzi.localeCompare(b.hanzi);
});
const orderOf = new Map<string, number>();
ordered.forEach(([id], i) => orderOf.set(id, i + 1));

// Segmentation vocabulary: hanzi → best word id (earliest in the learning order).
const byHanzi = new Map<string, string>();
for (const [id, d] of ordered) if (!byHanzi.has(d.hanzi)) byHanzi.set(d.hanzi, id);
/** Names Tatoeba uses all the time. They count as known and carry no word id. */
const NAMES: Record<string, string> = { 汤姆: 'Tāngmǔ', 玛丽: 'Mǎlì', 约翰: 'Yuēhàn', 杰克: 'Jiékè', 比尔: 'Bǐ\'ěr', 肯: 'Kěn', 露西: 'Lùxī', 迈克: 'Màikè', 米格: 'Mǐgé' };
const segVocab = new Set([...byHanzi.keys(), ...Object.keys(NAMES)]);

// ---------- sentences ----------
const sentences = new Map<string, VocabSentence>();
const wordPinyin = (id: string) => numericToMarks(drafts.get(id)!.numeric);

/** Tokenize, map to word ids, and work out the hardest word. Null if a character is unknown. */
function analyse(hanzi: string): { words: string[]; pinyin: string; unlocks: number } | null {
  const toks = tokenize(hanzi, segVocab);
  if (toks.some((t) => t.unknown)) return null;
  const words: string[] = [];
  let unlocks = 0;
  const withPy = toks.map((t) => {
    if (!t.key) return { text: t.text };
    if (NAMES[t.key]) return { text: t.text, pinyin: NAMES[t.key] };
    const id = byHanzi.get(t.key)!;
    words.push(id);
    unlocks = Math.max(unlocks, orderOf.get(id)!);
    return { text: t.text, pinyin: wordPinyin(id) };
  });
  return { words, pinyin: sentencePinyin(withPy), unlocks };
}

// Course sentences keep their own (checked) pinyin and their ids.
for (const u of units)
  for (const s of u.sentences) {
    const words = s.words.map((w) => legacyToNew.get(w)).filter((w): w is string => !!w);
    const unlocks = Math.max(0, ...words.map((w) => orderOf.get(w) ?? 0));
    sentences.set(s.id, {
      id: s.id,
      hanzi: s.hanzi,
      pinyin: s.pinyin,
      english: [s.english, ...(s.alt?.english ?? [])],
      words,
      unlocks,
      source: 'course',
    });
  }

let tatoebaSeen = 0;
let tatoebaUsable = 0;
async function readTsv(file: string, each: (cols: string[]) => void) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) if (line) each(line.split('\t'));
}
if (tatoebaDir) {
  const cmn = new Map<number, { text: string; user: string }>();
  await readTsv(join(tatoebaDir, 'cmn.tsv'), (c) => {
    if (c[1] === 'cmn') cmn.set(Number(c[0]), { text: c[2], user: c[3] ?? '' });
  });
  const links = new Map<number, number[]>();
  const engWanted = new Set<number>();
  await readTsv(join(tatoebaDir, 'links.tsv'), (c) => {
    const a = Number(c[0]);
    const b = Number(c[1]);
    if (!cmn.has(a)) return;
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    engWanted.add(b);
  });
  const eng = new Map<number, { text: string; user: string }>();
  await readTsv(join(tatoebaDir, 'eng.tsv'), (c) => {
    const id = Number(c[0]);
    if (c[1] === 'eng' && engWanted.has(id)) eng.set(id, { text: c[2], user: c[3] ?? '' });
  });
  for (const [id, zh] of cmn) {
    tatoebaSeen++;
    const text = zh.text.trim();
    const n = [...hanziOnly(text)].length;
    if (n < 3 || n > 18) continue;
    if (/[A-Za-z0-9０-９]/.test(text)) continue;
    if ([...text].some((c) => tradOnly.has(c))) continue;
    const en = (links.get(id) ?? []).map((e) => ({ id: e, ...eng.get(e)! })).filter((e) => e.text);
    if (!en.length) continue;
    const a = analyse(text);
    if (!a || !a.words.length) continue;
    en.sort((x, y) => x.text.length - y.text.length);
    tatoebaUsable++;
    sentences.set(`t${id}`, {
      id: `t${id}`,
      hanzi: text,
      pinyin: a.pinyin,
      english: [...new Set(en.map((e) => e.text))].slice(0, 3),
      words: a.words,
      unlocks: a.unlocks,
      source: 'tatoeba',
      by: { zh: zh.user, en: en[0].user, en_id: en[0].id },
    });
  }
  console.log(`Tatoeba: ${tatoebaSeen} Chinese sentences, ${tatoebaUsable} usable`);
}

// ---------- pick examples per word ("i+1": every other word comes earlier) ----------
const candidates = new Map<string, VocabSentence[]>();
for (const s of sentences.values()) for (const w of new Set(s.words)) (candidates.get(w) ?? candidates.set(w, []).get(w)!).push(s);
const MAX_EXAMPLES = 2;
const examples = new Map<string, string[]>();
const used = new Set<string>();
for (const [id] of ordered) {
  const order = orderOf.get(id)!;
  const list = candidates.get(id) ?? [];
  const score = (s: VocabSentence) => {
    const len = [...hanziOnly(s.hanzi)].length;
    const ideal = Math.abs(len - 8); // short, but a real sentence
    const course = s.source === 'course' ? -3 : 0; // hand-checked
    const late = s.unlocks > order ? 50 + (s.unlocks - order) / 50 : 0; // uses words learned later
    return late + ideal + course;
  };
  const pick = list
    .filter((s) => s.unlocks <= order + 300) // at most slightly ahead
    .sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))
    .slice(0, MAX_EXAMPLES);
  examples.set(id, pick.map((s) => s.id));
  pick.forEach((s) => used.add(s.id));
}

// Keep every course sentence, and only the Tatoeba sentences picked as examples.
const outSentences = [...sentences.values()].filter((s) => s.source === 'course' || used.has(s.id)).sort((a, b) => a.unlocks - b.unlocks || a.id.localeCompare(b.id));

const outWords: VocabWord[] = ordered.map(([id, d]) => ({
  id,
  hanzi: d.hanzi,
  ...(d.trad ? { trad: d.trad } : {}),
  pinyin: numericToMarks(d.numeric),
  numeric: normNum(d.numeric),
  level: d.level,
  order: orderOf.get(id)!,
  ...(d.hsk ? { hsk: d.hsk } : {}),
  pos: [...new Set(d.pos)],
  gloss: d.gloss,
  ...(d.classifiers.length ? { classifiers: d.classifiers } : {}),
  ...(d.freq ? { freq: d.freq } : {}),
  examples: examples.get(id) ?? [],
  ...(d.legacy.length ? { legacy: d.legacy } : {}),
}));

// ---------- validate and write ----------
for (const w of outWords) {
  const r = VocabWordSchema.safeParse(w);
  if (!r.success) problems.push(`Word ${w.id} ${w.hanzi}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  if (!w.gloss.length) problems.push(`Word ${w.id} ${w.hanzi}: no English gloss`);
}
for (const s of outSentences) {
  const r = VocabSentenceSchema.safeParse(s);
  if (!r.success) problems.push(`Sentence ${s.id}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}

mkdirSync(outDir, { recursive: true });
/** One item per line: readable diffs, small files. */
const lines = (items: unknown[]) => `[\n${items.map((x) => JSON.stringify(x)).join(',\n')}\n]\n`;
writeFileSync(join(outDir, 'words.json'), lines(outWords));
writeFileSync(join(outDir, 'sentences.json'), lines(outSentences));

const perLevel = [1, 2, 3, 4, 5, 6, 7, 0].map((l) => {
  const ws = outWords.filter((w) => w.level === l);
  const withEx = ws.filter((w) => w.examples.length).length;
  return `| ${l === 7 ? '7–9' : l === 0 ? 'course only' : l} | ${ws.length} | ${withEx} | ${ws.length - withEx} |`;
});
const bySource = (src: string) => outSentences.filter((s) => s.source === src).length;
const report = `# Vocabulary build report

Generated by \`scripts/build-vocab.ts\`. Do not edit by hand.

Sources: HSK 3.0 (ivankra/hsk30, MIT), frequency and classifiers (drkameleon/complete-hsk-vocabulary, MIT),
glosses ${cedictFile ? 'CC-CEDICT (CC BY-SA 4.0)' : 'drkameleon (CC-CEDICT not supplied in this run)'},
sentences ${tatoebaDir ? 'Tatoeba (CC BY 2.0 FR) and the course' : 'from the course only (Tatoeba not supplied in this run)'}.

## Words

${outWords.length} words. ${outWords.filter((w) => w.legacy).length} of them carry ids from the hand-written course, so progress on those carries over.

| HSK level | Words | With an example | Still need one |
|---|---|---|---|
${perLevel.join('\n')}

## Sentences

${outSentences.length} sentences: ${bySource('tatoeba')} from Tatoeba, ${bySource('course')} from the course, ${bySource('generated')} generated.
${tatoebaDir ? `Tatoeba had ${tatoebaSeen} Chinese sentences; ${tatoebaUsable} were simplified, short, translated into English and used only HSK words.` : ''}

## Problems (${problems.length})

${problems.slice(0, 300).map((p) => `- ${p}`).join('\n') || 'None.'}
${problems.length > 300 ? `\n…and ${problems.length - 300} more.` : ''}
`;
writeFileSync(join(outDir, 'REPORT.md'), report);
console.log(`Wrote ${outWords.length} words and ${outSentences.length} sentences to ${outDir}. ${problems.length} problems (see REPORT.md).`);
if (!existsSync(join(outDir, 'words.json'))) process.exit(1);
