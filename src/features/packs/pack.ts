/**
 * AI practice packs: JSON written by Claude (from the weak-spot export) and
 * imported into the app. Validated here with zod plus cross-reference checks,
 * then registered alongside the curriculum.
 */
import { z } from 'zod';
import { exchanges, sentences, words, dialogues } from '../../content';
import { DialogueSchema, ExchangeSchema, GrammarNoteSchema, SentenceSchema, WordSchema, type Word } from '../../content/schema';
import { toNumeric, hanziOnly, parsePinyin } from '../../lib/pinyin';

export const PACK_FORMAT = 'mandarin-practice-pack/1';
const packId = z.string().regex(/^p-[a-z0-9-]+$/, 'ids in a pack must start with "p-" and use lowercase letters, digits and dashes');

export const PackSchema = z.object({
  format: z.literal(PACK_FORMAT),
  title: z.string().min(1).max(80),
  focus: z.string().optional(),
  words: z.array(WordSchema.extend({ id: packId })).default([]),
  sentences: z.array(SentenceSchema.extend({ id: packId })).min(4, 'a pack needs at least 4 sentences'),
  exchanges: z.array(ExchangeSchema.extend({ id: packId })).default([]),
  notes: z.array(GrammarNoteSchema.extend({ id: packId })).default([]),
  dialogue: DialogueSchema.extend({ id: packId }).optional(),
});
export type Pack = z.infer<typeof PackSchema>;

export interface PackCheck {
  pack?: Pack;
  errors: string[];
}

/** Parse + validate pasted text. Accepts a bare JSON object or one wrapped in a ```json block. */
export function validatePack(text: string): PackCheck {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
  let raw: unknown;
  try {
    // House style: no em dashes in anything shown in the app.
    raw = JSON.parse(body.replace(/\s*—\s*/g, ', '));
  } catch (e) {
    return { errors: [`This isn't valid JSON (${(e as Error).message}). Copy the whole JSON block Claude gave you.`] };
  }
  const r = PackSchema.safeParse(raw);
  if (!r.success) {
    return { errors: r.error.issues.slice(0, 15).map((i) => `${i.path.join('.') || 'pack'}: ${i.message}`) };
  }
  const pack = r.data;
  const errors: string[] = [];
  const packWords = new Map(pack.words.map((w) => [w.id, w]));
  const packSentences = new Set(pack.sentences.map((s) => s.id));
  const seen = new Set<string>();
  for (const id of [...pack.words, ...pack.sentences, ...pack.exchanges, ...pack.notes].map((x) => x.id)) {
    if (seen.has(id)) errors.push(`duplicate id "${id}"`);
    seen.add(id);
  }
  pack.words.forEach((w, i) => {
    if (words.has(w.id)) errors.push(`words[${i}]: id "${w.id}" already exists`);
    if (!parsePinyin(w.pinyin, [...hanziOnly(w.hanzi)].length)) errors.push(`words[${i}] (${w.hanzi}): pinyin "${w.pinyin}" doesn't match the number of characters`);
  });
  const wordHanzi = (id: string) => packWords.get(id)?.hanzi ?? words.get(id)?.hanzi;
  pack.sentences.forEach((s, i) => {
    const where = `sentences[${i}] (${s.hanzi})`;
    if (sentences.has(s.id)) errors.push(`${where}: id "${s.id}" already exists (was this pack imported before?)`);
    let spelled = '';
    for (const id of s.words) {
      const hz = wordHanzi(id);
      if (hz === undefined) errors.push(`${where}: unknown word id "${id}". Add it to "words" or use an id from the vocabulary list`);
      else spelled += hz;
    }
    if (spelled && hanziOnly(spelled) !== hanziOnly(s.hanzi)) errors.push(`${where}: the word ids spell "${spelled}", not the sentence`);
    if (!parsePinyin(s.pinyin, [...hanziOnly(s.hanzi)].length)) errors.push(`${where}: pinyin "${s.pinyin}" doesn't match the number of characters`);
  });
  const sentenceExists = (id: string) => packSentences.has(id) || sentences.has(id);
  pack.exchanges.forEach((x, i) => {
    for (const ref of [x.prompt, x.reply, ...x.wrong]) if (!sentenceExists(ref)) errors.push(`exchanges[${i}]: unknown sentence "${ref}"`);
  });
  pack.notes.forEach((g, i) => g.examples.forEach((ref) => !sentenceExists(ref) && errors.push(`notes[${i}]: unknown sentence "${ref}"`)));
  if (pack.dialogue) {
    const sp = new Set(pack.dialogue.speakers.map((s) => s.id));
    pack.dialogue.lines.forEach((l, i) => {
      if (!sp.has(l.speaker)) errors.push(`dialogue.lines[${i}]: unknown speaker "${l.speaker}"`);
      if (!sentenceExists(l.sentence)) errors.push(`dialogue.lines[${i}]: unknown sentence "${l.sentence}"`);
    });
    pack.dialogue.questions.forEach((q, i) => q.answer >= q.options.length && errors.push(`dialogue.questions[${i}]: answer index out of range`));
  }
  return errors.length ? { errors } : { pack, errors: [] };
}

/** Make a pack's items available to lessons, look-ups and audio. */
export function registerPack(storeId: string, pack: Pack): void {
  const unit = `pack:${storeId}`;
  for (const w of pack.words) words.set(w.id, { ...w, pinyinNumeric: w.pinyinNumeric ?? toNumeric(w.pinyin), unit } as Word);
  for (const s of pack.sentences) sentences.set(s.id, { ...s, unit });
  for (const x of pack.exchanges) exchanges.set(x.id, { ...x, unit });
  if (pack.dialogue) dialogues.set(pack.dialogue.id, { ...pack.dialogue, unit });
}
