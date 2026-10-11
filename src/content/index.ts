/**
 * Loads the bundled curriculum and builds lookup indices.
 * Content ships inside the JS bundle, so it is precached and works offline.
 */
import { toNumeric } from '../lib/pinyin';
import courseJson from '../../content/course.json';
import soundsJson from '../../content/sounds.json';
import {
  CourseSchema,
  SoundsSchema,
  UnitSchema,
  type Dialogue,
  type Exchange,
  type GrammarNote,
  type Sentence,
  type SkillNode,
  type Sound,
  type Unit,
  type Word,
} from './schema';

const unitModules = import.meta.glob('../../content/units/*.json', { eager: true, import: 'default' });

export const course = CourseSchema.parse(courseJson);
export const sounds = SoundsSchema.parse(soundsJson);

const unitById = new Map<string, Unit>();
for (const raw of Object.values(unitModules)) {
  const u = UnitSchema.parse(raw);
  unitById.set(u.id, u);
}

/** Units in path order (as listed in course.json). */
export const units: Unit[] = course.sections.flatMap((s) => s.units.map((id) => unitById.get(id)!).filter(Boolean));

export const words = new Map<string, Word>();
export const sentences = new Map<string, Sentence>();
export const exchanges = new Map<string, Exchange & { unit: string }>();
export const grammar = new Map<string, GrammarNote>();
export const dialogues = new Map<string, Dialogue & { unit: string }>();
export const nodes = new Map<string, SkillNode & { unit: string; index: number }>();
export const soundById = new Map<string, Sound>(sounds.syllables.map((s) => [s.id, s]));

for (const u of units) {
  for (const w of u.words) words.set(w.id, { ...w, pinyinNumeric: w.pinyinNumeric ?? toNumeric(w.pinyin), unit: u.id });
  for (const s of u.sentences) sentences.set(s.id, { ...s, unit: u.id });
  for (const e of u.exchanges) exchanges.set(e.id, { ...e, unit: u.id });
  for (const g of u.grammar) grammar.set(g.id, g);
  if (u.dialogue) dialogues.set(u.dialogue.id, { ...u.dialogue, unit: u.id });
  u.nodes.forEach((n, index) => nodes.set(n.id, { ...n, unit: u.id, index }));
}

export function unitOf(nodeId: string): Unit {
  return unitById.get(nodes.get(nodeId)!.unit)!;
}

export function getUnit(id: string): Unit | undefined {
  return unitById.get(id);
}

/** Every node in path order. */
export const nodeOrder: string[] = units.flatMap((u) => u.nodes.map((n) => n.id));

/** Words whose hanzi spells the sentence, for tiles and tap-to-look-up. */
export function sentenceTokens(s: Sentence): Word[] {
  return s.words.map((id) => words.get(id)!).filter(Boolean);
}

/** A lookup entry for any item id (word, sentence or sound). */
export function lookup(id: string): { hanzi: string; pinyin: string; english: string } | undefined {
  const w = words.get(id);
  if (w) return { hanzi: w.hanzi, pinyin: w.pinyin, english: w.english.join('; ') };
  const s = sentences.get(id);
  if (s) return { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english };
  const t = soundById.get(id);
  if (t) return { hanzi: t.hanzi, pinyin: t.pinyin, english: '' };
  return undefined;
}

/** Find a word by its characters (for tapping hanzi). */
const byHanzi = new Map<string, Word>();
for (const w of words.values()) if (!byHanzi.has(w.hanzi)) byHanzi.set(w.hanzi, w);
export function wordByHanzi(h: string): Word | undefined {
  return byHanzi.get(h);
}
