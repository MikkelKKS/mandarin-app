/**
 * Cross-reference and consistency checks for curriculum content.
 * Pure: the caller supplies parsed files and an audio-exists function.
 */
import { polyphonic } from 'pinyin-pro';
import { hanziOnly, parsePinyin } from '../lib/pinyin';
import { CourseSchema, SoundsSchema, UnitSchema, type Course, type Sounds, type Unit } from './schema';
import { audioFilesFor } from './audioPaths';

export interface CheckReport {
  errors: string[];
  warnings: string[];
}

/** Readings (numeric, e.g. "hao3") pinyin-pro knows for a character. */
function readingsOf(ch: string): string[] {
  const r = polyphonic(ch, { toneType: 'num', type: 'array', v: true }) as string[][];
  return (r[0] ?? []).map((x) => x.toLowerCase());
}

/** Is `pinyinText` a plausible reading of `hanziText`? Returns an error message or null. */
export function checkPinyinAgainstHanzi(hanziText: string, pinyinText: string): string | null {
  const chars = [...hanziOnly(hanziText)];
  const syl = parsePinyin(pinyinText, chars.length);
  if (!syl) return `pinyin "${pinyinText}" can't be split into ${chars.length} syllables for "${hanziText}"`;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const s = syl[i];
    const readings = readingsOf(ch);
    if (readings.length === 0) continue; // unknown to the dictionary; skip
    const bases = readings.map((r) => r.replace(/\d$/, ''));
    if (!bases.includes(s.base)) {
      return `"${ch}" read as "${s.base}" in "${hanziText}" (dictionary has: ${readings.join(', ')})`;
    }
    const tones = readings.filter((r) => r.replace(/\d$/, '') === s.base).map((r) => Number(r.slice(-1)));
    const ok =
      s.tone === 5 ||
      tones.includes(s.tone) ||
      (ch === '不' && s.tone === 2) ||
      (ch === '一' && (s.tone === 2 || s.tone === 4));
    if (!ok) return `"${ch}" has tone ${s.tone} in "${hanziText}" (dictionary has: ${readings.join(', ')})`;
  }
  return null;
}

export function checkContent(
  rawCourse: unknown,
  rawUnits: Array<{ file: string; data: unknown }>,
  rawSounds: unknown,
  audioExists: (relPath: string) => boolean,
  hskLevels?: Map<string, number>,
): CheckReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // House style: no em dashes in any text shown in the app.
  const dashCheck = (file: string, data: unknown) => {
    const s = JSON.stringify(data);
    if (s.includes('—')) errors.push(`${file}: contains an em dash (—). Rephrase with a comma, colon or full stop.`);
  };
  dashCheck('course.json', rawCourse);
  rawUnits.forEach((u) => dashCheck(u.file, u.data));

  const courseRes = CourseSchema.safeParse(rawCourse);
  if (!courseRes.success) errors.push(...zodIssues('course.json', courseRes.error));
  const soundsRes = SoundsSchema.safeParse(rawSounds);
  if (!soundsRes.success) errors.push(...zodIssues('sounds.json', soundsRes.error));

  const units: Array<{ file: string; unit: Unit }> = [];
  for (const { file, data } of rawUnits) {
    const r = UnitSchema.safeParse(data);
    if (!r.success) errors.push(...zodIssues(file, r.error));
    else units.push({ file, unit: r.data });
  }
  if (errors.length) return { errors, warnings };

  const course = courseRes.data as Course;
  const sounds = soundsRes.data as Sounds;
  units.sort((a, b) => a.unit.order - b.unit.order);

  // Global id uniqueness
  const seen = new Map<string, string>();
  const claim = (kind: string, id: string, where: string) => {
    const prev = seen.get(id);
    if (prev) errors.push(`${where}: duplicate id "${id}" (${kind}), already used in ${prev}`);
    else seen.set(id, where);
  };

  const wordUnitOrder = new Map<string, number>();
  const wordHanzi = new Map<string, string>();
  for (const { file, unit } of units) {
    claim('unit', unit.id, file);
    for (const w of unit.words) {
      claim('word', w.id, file);
      wordUnitOrder.set(w.id, unit.order);
      wordHanzi.set(w.id, w.hanzi);
    }
    for (const s of unit.sentences) claim('sentence', s.id, file);
    for (const e of unit.exchanges) claim('exchange', e.id, file);
    for (const g of unit.grammar) claim('grammar', g.id, file);
    for (const n of unit.nodes) claim('node', n.id, file);
    if (unit.dialogue) claim('dialogue', unit.dialogue.id, file);
  }
  for (const s of sounds.syllables) claim('sound', s.id, 'sounds.json');

  // Course references
  const unitIds = new Set(units.map((u) => u.unit.id));
  for (const sec of course.sections) {
    for (const u of sec.units) if (!unitIds.has(u)) errors.push(`course.json: unknown unit "${u}"`);
  }
  for (const u of unitIds) {
    if (!course.sections.some((s) => s.units.includes(u))) warnings.push(`unit "${u}" is not listed in course.json`);
  }

  for (const { file, unit } of units) {
    const sentenceIds = new Set(unit.sentences.map((s) => s.id));
    const allSentenceIds = new Set(units.flatMap((u) => u.unit.sentences.map((s) => s.id)));
    const exchangeIds = new Set(unit.exchanges.map((e) => e.id));
    const grammarIds = new Set(unit.grammar.map((g) => g.id));
    const unitWordIds = new Set(unit.words.map((w) => w.id));

    for (const w of unit.words) {
      const msg = checkPinyinAgainstHanzi(w.hanzi, w.pinyin);
      if (msg) errors.push(`${file}: word ${w.id}: ${msg}`);
      for (const ex of w.examples ?? []) {
        if (!allSentenceIds.has(ex)) errors.push(`${file}: word ${w.id}: unknown example sentence "${ex}"`);
      }
      if (hskLevels) {
        const found = hskLevels.get(w.hanzi);
        const lvl = found && found <= 3 ? found : undefined;
        if (w.hsk >= 1 && w.hsk <= 3 && lvl !== w.hsk) {
          warnings.push(`${file}: word ${w.id} (${w.hanzi}) marked HSK ${w.hsk}, HSK list says ${lvl ?? 'not in HSK 1-3'}`);
        }
        if (w.hsk === 0 && lvl) warnings.push(`${file}: word ${w.id} (${w.hanzi}) marked HSK 0 but is HSK ${lvl}`);
      }
      if (w.measure && !wordHanzi.has(w.measure)) errors.push(`${file}: word ${w.id}: unknown measure word "${w.measure}"`);
    }

    for (const s of unit.sentences) {
      const where = `${file}: sentence ${s.id}`;
      const msg = checkPinyinAgainstHanzi(s.hanzi, s.pinyin);
      if (msg) errors.push(`${where}: ${msg}`);
      let spelled = '';
      for (const wid of s.words) {
        const hz = wordHanzi.get(wid);
        if (hz === undefined) {
          errors.push(`${where}: unknown word "${wid}"`);
          continue;
        }
        if ((wordUnitOrder.get(wid) ?? 0) > unit.order) errors.push(`${where}: uses "${wid}" before the unit that teaches it`);
        spelled += hz;
      }
      if (hanziOnly(spelled) !== hanziOnly(s.hanzi)) {
        errors.push(`${where}: word tokens spell "${spelled}" but the sentence is "${hanziOnly(s.hanzi)}"`);
      }
    }

    for (const e of unit.exchanges) {
      for (const ref of [e.prompt, e.reply, ...e.wrong]) {
        if (!sentenceIds.has(ref) && !allSentenceIds.has(ref)) errors.push(`${file}: exchange ${e.id}: unknown sentence "${ref}"`);
      }
    }
    for (const g of unit.grammar) {
      for (const ref of g.examples) if (!allSentenceIds.has(ref)) errors.push(`${file}: grammar ${g.id}: unknown sentence "${ref}"`);
    }
    if (unit.dialogue) {
      const d = unit.dialogue;
      const speakers = new Set(d.speakers.map((s) => s.id));
      d.lines.forEach((l, i) => {
        if (!speakers.has(l.speaker)) errors.push(`${file}: dialogue line ${i + 1}: unknown speaker "${l.speaker}"`);
        if (!allSentenceIds.has(l.sentence)) errors.push(`${file}: dialogue line ${i + 1}: unknown sentence "${l.sentence}"`);
      });
      d.questions.forEach((q, i) => {
        if (q.answer >= q.options.length) errors.push(`${file}: dialogue question ${i + 1}: answer index out of range`);
      });
    }

    const taught = new Set<string>();
    for (const n of unit.nodes) {
      for (const w of n.words) {
        if (!unitWordIds.has(w)) errors.push(`${file}: node ${n.id}: word "${w}" is not defined in this unit`);
        taught.add(w);
      }
      for (const s of n.sentences) if (!sentenceIds.has(s)) errors.push(`${file}: node ${n.id}: unknown sentence "${s}"`);
      for (const x of n.exchanges) if (!exchangeIds.has(x)) errors.push(`${file}: node ${n.id}: unknown exchange "${x}"`);
      for (const g of n.grammar) if (!grammarIds.has(g)) errors.push(`${file}: node ${n.id}: unknown grammar note "${g}"`);
      if (n.kind === 'story' && !unit.dialogue) errors.push(`${file}: node ${n.id}: story node but the unit has no dialogue`);
      if (n.kind === 'lesson' && n.words.length + n.sentences.length === 0) errors.push(`${file}: node ${n.id}: has no words or sentences`);
    }
    for (const w of unit.words) if (!taught.has(w.id)) warnings.push(`${file}: word ${w.id} is not taught by any node`);
  }

  const soundIds = new Set(sounds.syllables.map((s) => s.id));
  for (const s of sounds.syllables) {
    const msg = checkPinyinAgainstHanzi(s.hanzi, s.pinyin);
    if (msg) errors.push(`sounds.json: ${s.id}: ${msg}`);
  }
  for (const p of sounds.minimalPairs) {
    if (!soundIds.has(p.a) || !soundIds.has(p.b)) errors.push(`sounds.json: minimal pair ${p.a}/${p.b}: unknown syllable`);
  }

  // Audio files
  const missing: string[] = [];
  const need = (paths: string[]) => paths.forEach((p) => !audioExists(p) && missing.push(p));
  for (const { unit } of units) {
    unit.words.forEach((w) => need(audioFilesFor(w.id, false)));
    unit.sentences.forEach((s) => need(audioFilesFor(s.id, true)));
  }
  sounds.syllables.forEach((s) => need(audioFilesFor(s.id, false)));
  if (missing.length) {
    errors.push(`${missing.length} audio file(s) missing, e.g. ${missing.slice(0, 3).join(', ')} (run npm run audio:generate)`);
  }

  return { errors, warnings };
}

function zodIssues(file: string, err: { issues: Array<{ path: Array<string | number>; message: string }> }): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`);
}
