/**
 * Zod schemas for all curriculum content in /content.
 * Shared by the app (runtime validation of practice packs) and
 * scripts/validate-content.ts (CI validation of the shipped curriculum).
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids use lowercase letters, digits and dashes');
const hanzi = z.string().min(1);
const pinyin = z.string().min(1);

export const PartOfSpeech = z.enum([
  'noun',
  'pronoun',
  'verb',
  'adjective',
  'adverb',
  'number',
  'measure',
  'particle',
  'preposition',
  'conjunction',
  'phrase',
  'name',
  'time',
  'question',
  'interjection',
]);

export const WordSchema = z.object({
  id,
  hanzi,
  pinyin,
  /** Optional in files; derived from `pinyin` when omitted. */
  pinyinNumeric: z.string().optional(),
  english: z.array(z.string().min(1)).min(1),
  /** HSK level 1–3, or 0 for words outside HSK 1–3 (names, extras). */
  hsk: z.number().int().min(0).max(6),
  pos: PartOfSpeech,
  examples: z.array(id).optional(),
  /** Usual measure word (word id), for the Measure Word Match game. */
  measure: id.optional(),
  note: z.string().optional(),
});

export const SentenceSchema = z.object({
  id,
  hanzi,
  pinyin,
  english: z.string().min(1),
  /** Word ids in order; their hanzi must spell the sentence (minus punctuation). */
  words: z.array(id).min(1),
  alt: z
    .object({
      english: z.array(z.string()).optional(),
      pinyin: z.array(z.string()).optional(),
    })
    .optional(),
});

export const ExchangeSchema = z.object({
  id,
  /** What someone says to you. */
  prompt: id,
  /** A good reply. */
  reply: id,
  /** Replies that don't fit (still real sentences). */
  wrong: z.array(id).min(2),
  context: z.string().optional(),
});

export const GrammarNoteSchema = z.object({
  id,
  title: z.string(),
  body: z.string(),
  examples: z.array(id).default([]),
});

export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  hanzi: z.string().optional(),
  voice: z.enum(['f', 'm']),
});

export const QuestionSchema = z.object({
  q: z.string(),
  options: z.array(z.string()).min(2).max(4),
  answer: z.number().int().min(0),
});

export const DialogueSchema = z.object({
  id,
  title: z.string(),
  setting: z.string(),
  speakers: z.array(SpeakerSchema).min(2),
  lines: z.array(z.object({ speaker: z.string(), sentence: id })).min(2),
  questions: z.array(QuestionSchema).min(1),
});

export const ExerciseType = z.enum([
  'intro',
  'listen-meaning',
  'listen-sentence',
  'listen-tiles',
  'dictation',
  'tone-id',
  'minimal-pair',
  'what-would-you-say',
  'reply-type',
  'en-to-pinyin',
  'fill-gap',
  'build-sentence',
  'match-pairs',
  'pick-character',
  'read-sentence',
  'repeat',
]);

export const ExerciseSpecSchema = z.object({
  type: ExerciseType,
  /** Word, sentence, exchange or syllable id, depending on type. */
  item: z.string(),
  /** For match-pairs: several word ids. */
  items: z.array(z.string()).optional(),
});

export const LessonSchema = z.object({
  id,
  exercises: z.array(ExerciseSpecSchema).min(1),
});

export const NodeSchema = z.object({
  id,
  title: z.string(),
  kind: z.enum(['lesson', 'story']).default('lesson'),
  /** New words taught in this node. */
  words: z.array(id).default([]),
  sentences: z.array(id).default([]),
  exchanges: z.array(id).default([]),
  grammar: z.array(id).default([]),
  /** Optional hand-written lessons; otherwise lessons are generated. */
  lessons: z.array(LessonSchema).optional(),
});

export const UnitSchema = z.object({
  id,
  order: z.number().int(),
  title: z.string(),
  titleHanzi: z.string(),
  description: z.string(),
  hsk: z.number().int().min(0).max(3),
  words: z.array(WordSchema),
  sentences: z.array(SentenceSchema),
  exchanges: z.array(ExchangeSchema).default([]),
  grammar: z.array(GrammarNoteSchema).default([]),
  dialogue: DialogueSchema.optional(),
  nodes: z.array(NodeSchema).min(1),
});

export const SoundSchema = z.object({
  id,
  hanzi: z.string().length(1),
  pinyin,
});

export const SoundsSchema = z.object({
  syllables: z.array(SoundSchema),
  minimalPairs: z.array(
    z.object({ a: id, b: id, kind: z.enum(['initial', 'final', 'tone']), hint: z.string().optional() }),
  ),
});

export const CourseSchema = z.object({
  sections: z.array(
    z.object({
      id,
      title: z.string(),
      units: z.array(id),
    }),
  ),
  upcoming: z.array(z.object({ title: z.string(), titleHanzi: z.string() })).default([]),
});

export type Word = z.infer<typeof WordSchema> & { pinyinNumeric: string; unit: string };
export type Sentence = z.infer<typeof SentenceSchema> & { unit: string };
export type Exchange = z.infer<typeof ExchangeSchema>;
export type GrammarNote = z.infer<typeof GrammarNoteSchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type ExerciseKind = z.infer<typeof ExerciseType>;
export type ExerciseSpec = z.infer<typeof ExerciseSpecSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type SkillNode = z.infer<typeof NodeSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type Sounds = z.infer<typeof SoundsSchema>;
export type Course = z.infer<typeof CourseSchema>;
