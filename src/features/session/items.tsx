/**
 * The exercises a session is made of. Each one calls `onResult` once with
 * what happened; the player records it, shows feedback and moves on.
 * Pinyin first: characters only when "Characters: Show" is on.
 */
import { glossTerms, samePinyin } from '../../lib/gloss';
import { isPass } from '../../lib/pinyinAnswer';
import { inContext, type InContext } from '../../lib/context';
import { grammarFor } from '../../lib/grammar';
import { GrammarNoteCard } from '../../components/GrammarNote';
import { VolumeSlider } from '../../components/VolumeSlider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { play, playUrl, rememberText } from '../../lib/audio';
import { markSyllable, type Tone } from '../../lib/pinyin';
import { useSettings } from '../../lib/settings';
import { meaningOf, type SentenceRow, type VocabData, type VocabRow } from '../../lib/vocabData';
import { checkTyped } from '../exercises/check';
import { AudioControls, Options, PinyinInput, Prompt } from '../exercises/parts';
import { useCheck } from '../lesson/context';
import type { Outcome } from '../lesson/types';
import type { RatingName } from '../../lib/review';
import { patternLabel, TONE_WORD, type GymItem } from '../tonegym/model';
import { meaningMatches } from './meaning';
import { Speak } from './Speak';
import { LookUp } from '../../components/LookUp';
import { ReadingItem } from '../reading/ReadItems';
import type { SItem } from './plan';

export interface ItemResult {
  outcome: Outcome;
  /** The sentence the word was heard in (homophones and particles), shown with the word highlighted. */
  context?: { before: string; target: string; after: string; english?: string; id?: string };
  /** A self-grade (listening for meaning): recorded as given, no feedback panel. */
  rating?: RatingName;
  typed?: boolean;
  /** Skip the feedback panel (intro, self-graded items). */
  skipFeedback?: boolean;
  /** Extra content for the feedback panel (reading: meaning, building blocks, look-alikes). */
  panel?: React.ReactNode;
  /** Audio to replay from the feedback panel instead of the item's own. */
  audio?: () => void;
  /** What "Look up" searches in the feedback panel, when the answer doesn't show characters. */
  lookup?: string;
}

export interface ItemProps {
  item: SItem;
  data: VocabData;
  onResult: (r: ItemResult) => void;
  /** "No mic right now": drop the speaking questions from this session. */
  onNoMic?: () => void;
  /** "I don't know this word" (review questions only): back to new words, taught again. */
  onUnknown?: () => void;
}

/** A quiet button under a review question: you've never really known this word. */
export function DontKnow({ onUnknown }: { onUnknown?: () => void }) {
  if (!onUnknown) return null;
  return (
    <button onClick={onUnknown} className="mt-3 h-11 w-full rounded-2xl text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
      I don't know this word
    </button>
  );
}

const glossOf = (w: VocabRow) => meaningOf(w);

/** Part of speech in plain words ("verb", "measure word"…), or nothing when it's unclear. */
export function posLabel(pos?: string[]): string | null {
  const map: Record<string, string> = { pr: 'pronoun', intj: 'interjection', 'sound word': 'sound word' };
  const list = [...new Set((pos ?? []).map((p) => map[p] ?? p))].filter((p) => !['name', 'phrase', 'time', 'number'].includes(p));
  return list.length ? list.slice(0, 2).join(' / ') : null;
}

/** Other HSK words that the shown meaning fits too (néng, huì, kěyǐ for "can"). */
export function sameMeaning(w: VocabRow, words: VocabRow[]): VocabRow[] {
  const shown = glossTerms([glossOf(w)]);
  return words.filter((x) => x.id !== w.id && !samePinyin(x.pinyin, w.pinyin) && [...glossTerms(x.gloss.slice(0, 2))].some((t) => shown.has(t)));
}

/** Characters, when the setting is on. */
function Hanzi({ text, className = '' }: { text: string; className?: string }) {
  const { showHanzi } = useSettings();
  if (!showHanzi) return null;
  return (
    <span className={`han ${className}`} lang="zh-CN">
      {text}
    </span>
  );
}

function useWord(data: VocabData, id: string): VocabRow {
  const w = data.byId.get(id)!;
  rememberText(w.id, w.hanzi);
  return w;
}
function useSentence(data: VocabData, id: string): SentenceRow {
  const s = data.sentences.get(id)!;
  rememberText(s.id, s.hanzi);
  return s;
}

export function SessionItem(p: ItemProps) {
  switch (p.item.kind) {
    case 'intro':
      return <Intro {...p} word={p.item.word} />;
    case 'choose-meaning':
      return <ChooseMeaning {...p} word={p.item.word} options={p.item.options} ctx={p.item.ctx} />;
    case 'listen-meaning':
      return <ListenMeaning {...p} word={p.item.word} ctx={p.item.ctx} />;
    case 'dictation':
      return <Dictation {...p} word={p.item.word} ctx={p.item.ctx} />;
    case 'meaning-pinyin':
      return <MeaningToPinyin {...p} word={p.item.word} />;
    case 'sentence-dictation':
      return <SentenceDictation {...p} sentence={p.item.sentence} />;
    case 'sentence-meaning':
      return <SentenceMeaning {...p} sentence={p.item.sentence} />;
    case 'sentence-pinyin':
      return <SentenceToPinyin {...p} sentence={p.item.sentence} />;
    case 'tone':
      return <ToneQuestion {...p} gym={p.item.gym} />;
    case 'speak':
      return <Speak data={p.data} word={p.item.word} onResult={p.onResult} onNoMic={p.onNoMic ?? (() => {})} />;
    case 'read-intro':
    case 'read-pinyin':
    case 'read-meaning':
      return <ReadingItem item={p.item} onResult={p.onResult} />;
  }
}

/** The word inside its sentence (homophones and particles), when the item has one. */
function useContext(data: VocabData, w: VocabRow, ctx?: string): InContext | null {
  return useMemo(() => {
    if (!ctx) return null;
    const c = inContext(w, data, (s) => s.id === ctx);
    if (c) rememberText(c.sentence.id, c.sentence.hanzi);
    return c;
  }, [data, w, ctx]);
}

/** A sentence's pinyin with the word highlighted, or left blank to fill in. */
export function ContextLine({ c, blank = false, className = '' }: { c: { before: string; target: string; after: string }; blank?: boolean; className?: string }) {
  return (
    <p className={`text-center text-xl leading-relaxed ${className}`}>
      {c.before && <TonePinyin pinyin={c.before} className="mr-1.5" />}
      {blank ? (
        <span className="mx-0.5 inline-block w-14 border-b-2 border-ink align-baseline" aria-label="missing word" />
      ) : (
        <mark className="rounded-md bg-amber-soft px-1 font-semibold text-inherit">
          <TonePinyin pinyin={c.target} />
        </mark>
      )}
      {c.after && <TonePinyin pinyin={c.after} className="ml-1.5" />}
    </p>
  );
}

/** Meeting a new word: hear it (twice), see it, see it in a sentence. */
function Intro({ data, word, onResult }: ItemProps & { word: string }) {
  const w = useWord(data, word);
  const ex = w.examples.map((e) => data.sentences.get(e)).find(Boolean);
  const note = grammarFor(w);
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      await play(w.id);
      if (live) setTimeout(() => live && void play(w.id), 400);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [w.id]);
  useCheck(() => {
    onResult({ outcome: { verdict: 'correct' }, skipFeedback: true });
    return null as unknown as Outcome;
  }, []);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm font-medium text-jade">New word{w.level > 0 && w.level < 7 ? ` · HSK ${w.level}` : w.level === 7 ? ' · HSK 7–9' : ''}</p>
      <div className="mt-6">
        <AudioControls id={w.id} autoPlay={false} />
      </div>
      <TonePinyin pinyin={w.pinyin} className="mt-6 block text-5xl font-semibold" />
      <Hanzi text={w.hanzi} className="mt-2 block text-3xl text-muted" />
      <p className="mt-4 text-xl">{glossOf(w)}</p>
      {note && <GrammarNoteCard note={note} className="mt-6 w-full" />}
      {ex && !note && (
        <div className="mt-8 w-full rounded-2xl bg-surface p-4 text-left border border-line">
          <div className="flex items-center gap-3">
            <button onClick={() => void play(ex.id)} aria-label="Play the example" className="rounded-full bg-jade-soft p-2 text-jade">
              <Speaker className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <TonePinyin pinyin={ex.pinyin} className="block text-lg" />
              <Hanzi text={ex.hanzi} className="block text-muted" />
              <p className="text-sm text-muted">{ex.english[0]}</p>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => onResult({ outcome: { verdict: 'correct' }, skipFeedback: true })}
        className="press mt-8 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink"
      >
        Got it
      </button>
    </div>
  );
}

/** First exposure only: hear it, pick the meaning. */
function ChooseMeaning({ data, word, options, ctx, onResult }: ItemProps & { word: string; options: string[]; ctx?: string }) {
  const w = useWord(data, word);
  const c = useContext(data, w, ctx);
  const [picked, setPicked] = useState<number | null>(null);
  const opts = options.map((id) => data.byId.get(id)!).filter(Boolean);
  const right = opts.findIndex((o) => o.id === w.id);
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onResult({ outcome: { verdict: i === right ? 'correct' : 'wrong', answer: { pinyin: w.pinyin, english: glossOf(w), hanzi: w.hanzi } }, context: c ? { ...c, english: c.sentence.english[0], id: c.sentence.id } : undefined });
  };
  return (
    <div>
      <Prompt>{c ? 'What does the marked word mean here?' : 'What does it mean?'}</Prompt>
      <AudioControls id={c?.sentence.id ?? w.id} ladder />
      {c && <ContextLine c={c} className="mt-5" />}
      <div className="mt-8">
        <Options
          count={opts.length}
          selected={picked}
          onSelect={choose}
          render={(i) => glossOf(opts[i])}
          stateOf={(i) => (picked === null ? 'idle' : i === right ? 'right' : i === picked ? 'wrong' : 'idle')}
        />
      </div>
    </div>
  );
}

/** Review, listening → meaning: hear it, think (or type) the meaning, then grade yourself. */
function ListenMeaning({ data, word, ctx, onResult, onUnknown }: ItemProps & { word: string; ctx?: string }) {
  const w = useWord(data, word);
  const c = useContext(data, w, ctx);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState('');
  const match = shown && typed.trim() ? meaningMatches(typed, w.short ? [w.short, ...w.gloss] : w.gloss) : null;
  const grade = (r: RatingName) =>
    onResult({ outcome: { verdict: r === 'again' ? 'wrong' : r === 'hard' ? 'almost' : 'correct' }, rating: r, skipFeedback: true });
  useCheck(() => {
    setShown(true);
    return null as unknown as Outcome;
  }, []);
  return (
    <div>
      <Prompt>{c ? 'What does the marked word mean here?' : 'What does it mean?'}</Prompt>
      <AudioControls id={c?.sentence.id ?? w.id} ladder />
      {c && <ContextLine c={c} className="mt-5" />}
      {!shown ? (
        <div className="mt-8">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setShown(true))}
            placeholder="Type the meaning (optional)"
            aria-label="The meaning in English"
            autoComplete="off"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-lg outline-none focus:border-jade"
          />
          <button onClick={() => setShown(true)} className="press mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            Show the answer
          </button>
          <DontKnow onUnknown={onUnknown} />
        </div>
      ) : (
        <div className="anim-rise mt-8 rounded-2xl bg-surface p-4 border border-line">
          <TonePinyin pinyin={w.pinyin} className="text-3xl font-semibold" /> <Hanzi text={w.hanzi} className="ml-2 text-2xl text-muted" />
          <p className="mt-1 text-lg">{glossOf(w)}</p>
          {c && <p className="mt-1 text-sm text-muted">The sentence: {c.sentence.english[0]}</p>}
          <LookUp text={c ? c.sentence.hanzi : w.hanzi} className="mt-1" />
          {match !== null && <p className={`mt-1 text-sm ${match ? 'text-jade' : 'text-muted'}`}>{match ? 'Your answer matches.' : `You wrote “${typed.trim()}”.`}</p>}
          <SelfGrade onGrade={grade} suggest={match === true ? 'good' : match === false ? 'again' : undefined} />
          <DontKnow onUnknown={onUnknown} />
        </div>
      )}
    </div>
  );
}

export function SelfGrade({ onGrade, suggest }: { onGrade: (r: RatingName) => void; suggest?: RatingName }) {
  const opts: Array<{ r: RatingName; label: string; hint: string }> = [
    { r: 'again', label: 'Again', hint: "Didn't know" },
    { r: 'hard', label: 'Hard', hint: 'Took a while' },
    { r: 'good', label: 'Good', hint: 'Knew it' },
    { r: 'easy', label: 'Easy', hint: 'Instantly' },
  ];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        e.preventDefault();
        onGrade(opts[n - 1].r);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-muted">How well did you know it?</p>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Grade yourself">
        {opts.map((o, i) => (
          <button
            key={o.r}
            onClick={() => onGrade(o.r)}
            className={`flex h-16 flex-col items-center justify-center rounded-2xl border font-semibold transition active:scale-95 ${suggest === o.r ? 'border-jade bg-jade-soft' : 'border-line bg-surface'}`}
          >
            {o.label}
            <span className="text-[11px] font-normal text-muted">
              <span className="hidden sm:inline">{i + 1} · </span>
              {o.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Typed pinyin, checked syllable by syllable (or by a custom checker). */
export function useTyped(expected: { pinyin: string; hanzi: string; english?: string }, onResult: (r: ItemResult) => void, checker?: (text: string) => Outcome) {
  const [text, setText] = useState('');
  const done = useRef(false);
  const check = () => {
    if (done.current || !text.trim()) return null as unknown as Outcome;
    done.current = true;
    const o = checker ? checker(text) : checkTyped(text, expected);
    onResult({ outcome: o, typed: true });
    return null as unknown as Outcome;
  };
  useCheck(check, [text]);
  return { text, setText, check };
}

export function TypeBox({ text, setText, check, onUnknown }: ReturnType<typeof useTyped> & { onUnknown?: () => void }) {
  return (
    <div className="mt-8">
      <PinyinInput value={text} onChange={setText} />
      <button onClick={check} disabled={!text.trim()} className="press mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted">
        Check
      </button>
      <DontKnow onUnknown={onUnknown} />
    </div>
  );
}

/** Review, listening → pinyin: dictation (in its sentence, for homophones and particles: type the missing word). */
function Dictation({ data, word, ctx, onResult, onUnknown }: ItemProps & { word: string; ctx?: string }) {
  const w = useWord(data, word);
  const c = useContext(data, w, ctx);
  const t = useTyped({ pinyin: w.pinyin, hanzi: w.hanzi, english: glossOf(w) }, (r) => onResult(c ? { ...r, context: { ...c, english: c.sentence.english[0], id: c.sentence.id } } : r));
  return (
    <div>
      <Prompt>{c ? 'Listen, then type the missing word with tones' : 'Type what you hear, with tones'}</Prompt>
      <AudioControls id={c?.sentence.id ?? w.id} ladder />
      {c && <ContextLine c={c} blank className="mt-5" />}
      <TypeBox {...t} onUnknown={onUnknown} />
    </div>
  );
}

/** Review, meaning → pinyin: active recall, with part of speech and the example sentence (word blanked) to tell near-synonyms apart. */
function MeaningToPinyin({ data, word, onResult, onUnknown }: ItemProps & { word: string }) {
  const w = useWord(data, word);
  const c = useMemo(() => inContext(w, data, () => true), [w, data]);
  const others = useMemo(() => sameMeaning(w, data.words), [w, data.words]);
  const expected = { pinyin: w.pinyin, hanzi: w.hanzi, english: glossOf(w) };
  const t = useTyped(expected, onResult, (text) => {
    const o = checkTyped(text, expected);
    if (isPass(o.verdict)) return o;
    // Another HSK word with this meaning: right, just not the one we meant.
    const other = others.find((x) => isPass(checkTyped(text, { pinyin: x.pinyin, hanzi: x.hanzi }).verdict));
    if (other) return { verdict: 'correct', answer: o.answer, note: `Also right: ${other.pinyin} means that too. We were looking for ${w.pinyin}.` };
    return o;
  });
  const pos = posLabel(w.pos);
  return (
    <div>
      <Prompt>How do you say it? Type the pinyin with tones</Prompt>
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-2xl font-semibold">{glossOf(w)}</p>
        {pos && <p className="mt-1 text-sm text-muted">{pos}</p>}
        {c && (
          <div className="mt-4 border-t border-line pt-3">
            <ContextLine c={c} blank className="!text-lg" />
            <p className="mt-1 text-sm text-muted">{c.sentence.english[0]}</p>
          </div>
        )}
      </div>
      <TypeBox {...t} onUnknown={onUnknown} />
    </div>
  );
}

/** Listening block / sentence review: dictation of a short sentence. */
function SentenceDictation({ data, sentence, onResult }: ItemProps & { sentence: string }) {
  const s = useSentence(data, sentence);
  const t = useTyped({ pinyin: s.pinyin, hanzi: s.hanzi, english: s.english[0] }, onResult);
  return (
    <div>
      <Prompt>Type the sentence you hear, in pinyin</Prompt>
      <AudioControls id={s.id} ladder />
      <TypeBox {...t} />
    </div>
  );
}

/** Deep sessions: say it in Chinese. English → the whole sentence in pinyin. */
function SentenceToPinyin({ data, sentence, onResult }: ItemProps & { sentence: string }) {
  const s = useSentence(data, sentence);
  const t = useTyped({ pinyin: s.pinyin, hanzi: s.hanzi, english: s.english[0] }, onResult);
  return (
    <div>
      <Prompt>Say it in Chinese: type the pinyin with tones</Prompt>
      <p className="rounded-2xl border border-line bg-surface p-5 text-center text-xl font-medium leading-snug">{s.english[0]}</p>
      <p className="mt-2 text-center text-xs text-muted">Only words you've already met.</p>
      <TypeBox {...t} />
    </div>
  );
}

/** Listening block: hear a sentence of words you know, then check whether you understood. */
function SentenceMeaning({ data, sentence, onResult }: ItemProps & { sentence: string }) {
  const s = useSentence(data, sentence);
  const [shown, setShown] = useState(false);
  useCheck(() => {
    setShown(true);
    return null as unknown as Outcome;
  }, []);
  const answer = (verdict: 'correct' | 'almost' | 'wrong') => onResult({ outcome: { verdict }, skipFeedback: true });
  return (
    <div>
      <Prompt>Listen. Do you understand it?</Prompt>
      <AudioControls id={s.id} ladder />
      {!shown ? (
        <button onClick={() => setShown(true)} className="press mt-8 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Show what it says
        </button>
      ) : (
        <div className="anim-rise mt-8 rounded-2xl bg-surface p-4 border border-line">
          <TonePinyin pinyin={s.pinyin} className="block text-xl" />
          <Hanzi text={s.hanzi} className="block text-lg text-muted" />
          <p className="mt-1">{s.english[0]}</p>
          <LookUp text={s.hanzi} className="mt-1" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => answer('wrong')} className="h-14 rounded-2xl border border-line bg-surface font-semibold">
              Not really
            </button>
            <button onClick={() => answer('almost')} className="h-14 rounded-2xl border border-line bg-surface font-semibold">
              Partly
            </button>
            <button onClick={() => answer('correct')} className="h-14 rounded-2xl border border-jade bg-jade-soft font-semibold">
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];

/** A Tone Gym question inside a session. */
function ToneQuestion({ gym, onResult }: ItemProps & { gym: GymItem }) {
  const [picked, setPicked] = useState<Array<Tone | null>>([null, null]);
  const [done, setDone] = useState(false);
  const speaker = useMemo(() => Math.floor(Math.random() * gym.sources.length), [gym]);
  const say = (k = speaker) => void playUrl(gym.sources[k % gym.sources.length].url);
  useEffect(() => {
    const t = setTimeout(() => say(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym.word]);
  const pick = (slot: number, t: Tone) => {
    if (done) return;
    const next = [...picked];
    next[slot] = t;
    setPicked(next);
    const given = next.slice(0, gym.tones.length);
    if (given.every((x) => x !== null)) {
      setDone(true);
      const right = given.every((x, k) => x === gym.tones[k]);
      onResult({
        outcome: {
          verdict: right ? 'correct' : 'wrong',
          answer: { pinyin: gym.pinyin, english: gym.gloss },
          note: right ? gym.sandhi && `Spoken ${gym.sandhi.spoken}. ${gym.sandhi.why}` : `It was ${patternLabel(gym.pattern)}, not ${patternLabel(given.join('-'))}.${gym.sandhi ? ` Spoken ${gym.sandhi.spoken}.` : ''}`,
          tones: { expected: gym.tones.join('-'), given: given.join('-') },
        },
      });
      if (!right) setTimeout(() => say(), 350);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done || !/^[0-5]$/.test(e.key)) return;
      const t = (e.key === '0' ? 5 : Number(e.key)) as Tone;
      const slot = picked[0] === null ? 0 : 1;
      if (t === 5 && slot === 0) return;
      e.preventDefault();
      pick(slot, t);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div>
      <Prompt>Tone Gym: which tone{gym.tones.length > 1 ? 's' : ''}?</Prompt>
      <div className="flex flex-col items-center">
        <button onClick={() => say()} aria-label="Play again" className="press flex h-20 w-20 items-center justify-center rounded-full bg-jade text-jade-ink">
          <Speaker className="h-9 w-9" />
        </button>
        {gym.sources.length > 1 && (
          <button onClick={() => say(speaker + 1)} className="mt-2 text-sm font-medium text-jade">
            Another voice
          </button>
        )}
        <VolumeSlider className="mt-2" />
        <p className="mt-4 text-3xl font-semibold">{gym.bases.map((b) => b.replace(/v/g, 'ü')).join(' ')}</p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {gym.tones.map((_, slot) => (
          <div key={slot} className={`grid gap-2 ${slot === 1 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {([1, 2, 3, 4, 5] as Tone[])
              .filter((t) => t !== 5 || slot === 1)
              .map((t) => {
                const chosen = picked[slot] === t;
                const right = done && gym.tones[slot] === t;
                return (
                  <button
                    key={t}
                    onClick={() => pick(slot, t)}
                    disabled={done}
                    aria-label={`${TONE_WORD[t]} tone${gym.tones.length > 1 ? `, syllable ${slot + 1}` : ''}`}
                    className={`h-14 rounded-2xl border text-lg font-semibold ${TONE_TEXT[t]} ${right ? 'border-jade bg-jade-soft' : done && chosen ? 'border-cinnabar bg-cinnabar-soft' : chosen ? 'border-ink bg-surface' : 'border-line bg-surface'}`}
                  >
                    {markSyllable({ base: gym.bases[slot], tone: t })}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
