import { SyllableBreakdown } from '../../components/SyllableBreakdown';
import { focusNoScroll } from '../../lib/router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToneText, TonePinyin } from '../../components/Hanzi';
import { Check, Close, Headphones, MicOff, Speaker } from '../../components/icons';
import { preload, play, stop } from '../../lib/audio';
import { isPass, type Verdict } from '../../lib/pinyinAnswer';
import { setQuietUntil, setSpeakPausedUntil, useQuietUntil } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { shuffle } from '../../lib/random';
import { recordAnswer, regradeAll } from '../../lib/srs';
import type { RatingName } from '../../lib/review';
import { GradeChip } from './GradeChip';
import { audioOf, ExerciseView, itemsOf } from '../exercises/ExerciseView';
import { LessonCtx, type LessonApi } from './context';
import { AUDIO_ONLY, type Exercise, type ExerciseKind, type Outcome } from './types';

/** Exercises answered by typing (or arranging tiles): they get more time before counting as slow. */
const TYPED: ReadonlySet<ExerciseKind> = new Set(['dictation', 'en-to-pinyin', 'reply-type', 'fill-gap', 'build-sentence', 'listen-tiles']);

export interface LessonResult {
  accuracy: number; // first-attempt pass rate, 0 to 1
  ms: number;
  newWords: string[];
  mistakes: string[]; // item ids answered wrong at least once
  /** Exercises answered wrong first time and then fixed (some exercises, like sound drills, have no item ids). */
  fixed?: number;
  total: number;
}

interface Entry {
  ex: Exercise;
  origin: string; // key of the original exercise
  retry: number;
}

/** A retried exercise gets its options shuffled, so the answer can't be remembered by position. */
function reshuffle(ex: Exercise, key: string): Exercise {
  if ('options' in ex && 'answer' in ex && Array.isArray(ex.options)) {
    const right = ex.options[ex.answer];
    const options = shuffle(ex.options);
    return { ...ex, key, options, answer: options.indexOf(right) } as Exercise;
  }
  if (ex.kind === 'minimal-pair' && Math.random() < 0.5) return { ...ex, key, a: ex.b, b: ex.a, answer: ex.answer === 0 ? 1 : 0 };
  if ('tiles' in ex) return { ...ex, key, tiles: shuffle(ex.tiles) } as Exercise;
  return { ...ex, key };
}

export function LessonPlayer({
  title,
  exercises,
  mode = 'lesson',
  nodeId,
  onExit,
  onFinish,
}: {
  title: string;
  exercises: Exercise[];
  mode?: 'lesson' | 'testout' | 'practice';
  nodeId?: string;
  onExit: () => void;
  onFinish: (r: LessonResult) => void;
}) {
  const [queue, setQueue] = useState<Entry[]>(() => exercises.map((ex) => ({ ex, origin: ex.key, retry: 0 })));
  const [pos, setPos] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [canCheck, setCanCheck] = useState(false);
  const checkRef = useRef<(() => Outcome | null) | null>(null);
  const replayRef = useRef<(() => void) | null>(null);
  const firstResults = useRef(new Map<string, Verdict>());
  const passed = useRef(new Set<string>());
  const mistakes = useRef(new Set<string>());
  const started = useRef(Date.now());
  // When the current exercise appeared, to time the answer (slow answers grade as Hard).
  const shownAt = useRef(Date.now());
  // Cards the first answer to this exercise updated, and the grade they got (for "change grade").
  const [graded, setGraded] = useState<{ cards: string[]; rating: RatingName } | null>(null);
  const quietUntil = useQuietUntil();
  const quiet = quietUntil > Date.now();

  const scoredTotal = useMemo(() => exercises.filter((e) => e.kind !== 'intro' && e.kind !== 'repeat').length, [exercises]);
  const current = queue[pos];

  // Preload the next exercise's audio.
  useEffect(() => {
    const next = queue[pos + 1];
    if (next) preload(audioOf(next.ex), next.ex.voice);
  }, [pos, queue]);

  useEffect(() => () => stop(), []);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [pos]);

  const finish = useCallback(() => {
    const scored = [...firstResults.current.values()];
    const ok = scored.filter(isPass).length;
    sfx.finish();
    onFinish({
      accuracy: scored.length ? ok / scored.length : 1,
      ms: Date.now() - started.current,
      newWords: exercises.filter((e) => e.kind === 'intro').map((e) => (e as Extract<Exercise, { kind: 'intro' }>).wordId),
      mistakes: [...mistakes.current],
      fixed: scored.length - ok,
      total: scoredTotal,
    });
  }, [exercises, onFinish, scoredTotal]);

  const advance = useCallback(() => {
    stop();
    setOutcome(null);
    setGraded(null);
    checkRef.current = null;
    setCanCheck(false);
    if (pos + 1 >= queue.length) finish();
    else setPos(pos + 1);
  }, [pos, queue.length, finish]);

  const handleOutcome = useCallback(
    (o: Outcome) => {
      if (!current || outcome) return;
      const { ex, origin, retry } = current;
      if (ex.kind === 'intro' || ex.kind === 'repeat') {
        // Meeting a word gives it its review cards (listening and typing), not graded yet.
        if (ex.kind === 'intro' && !passed.current.has(origin)) void recordAnswer(ex.wordId, 'correct', { exercise: 'intro', nodeId });
        passed.current.add(origin);
        advance();
        return;
      }
      // End-to-end tests answer at random; this flag (set only by the tests) treats every answer as right.
      if ((window as unknown as { __e2eAlwaysCorrect?: boolean }).__e2eAlwaysCorrect) o = { ...o, verdict: 'correct' };
      if (o.verdict === 'wrong') sfx.wrong();
      else if (o.verdict === 'almost') sfx.almost();
      else sfx.correct();

      const items = o.items ?? itemsOf(ex).map((id) => ({ id, verdict: o.verdict }));
      if (!firstResults.current.has(origin)) {
        firstResults.current.set(origin, o.verdict);
        const info = { exercise: ex.kind, nodeId, tones: o.tones, ms: Date.now() - shownAt.current, typed: TYPED.has(ex.kind), syllables: o.syllables?.length };
        void Promise.all(items.map((it) => recordAnswer(it.id, it.verdict, info))).then((rs) => {
          const cards = rs.flatMap((r) => (r.card ? [r.card] : []));
          const rating = rs.find((r) => r.rating)?.rating;
          if (cards.length && rating) setGraded({ cards, rating });
        });
      }
      for (const it of items) if (it.verdict === 'wrong') mistakes.current.add(it.id);

      if (isPass(o.verdict) || mode === 'testout') passed.current.add(origin);
      else {
        // Wrong: it comes back at the end until it's answered correctly.
        setQueue((q) => [...q, { ex: reshuffle(ex, `${origin}-r${retry + 1}`), origin, retry: retry + 1 }]);
      }
      setOutcome(o);
    },
    [current, outcome, advance, mode, nodeId],
  );

  /** "I was right": a differently worded answer counts as correct after all. */
  const override = useCallback(() => {
    if (!current || !outcome) return;
    const { ex, origin, retry } = current;
    if (retry === 0) {
      firstResults.current.set(origin, 'correct');
      // The first answer was recorded as wrong: change its grade to Good.
      if (graded) void regradeAll(graded.cards, 'good').then(() => setGraded({ ...graded, rating: 'good' }));
    }
    passed.current.add(origin);
    for (const id of itemsOf(ex)) mistakes.current.delete(id);
    // Drop the retry that was queued for this exercise.
    setQueue((q) => q.filter((e, i) => !(i > pos && e.origin === origin && e.retry === retry + 1)));
    sfx.correct();
    setOutcome({ ...outcome, verdict: 'correct', note: 'Counted as correct.', canOverride: false });
  }, [current, outcome, pos, graded]);

  /** The grade buttons: change the grade the first answer got. */
  const changeGrade = useCallback(
    (r: RatingName) => {
      if (!graded) return;
      void regradeAll(graded.cards, r).then(() => setGraded({ ...graded, rating: r }));
    },
    [graded],
  );

  const doCheck = useCallback(() => {
    const fn = checkRef.current;
    if (!fn) return;
    const o = fn();
    if (o) handleOutcome(o);
  }, [handleOutcome]);

  // Keyboard: Enter = check / continue; space = replay audio.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.key === 'Enter') {
        e.preventDefault();
        if (outcome) advance();
        else doCheck();
      } else if (e.key === ' ' && !typing) {
        e.preventDefault();
        replayRef.current?.();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [outcome, advance, doCheck]);

  const api: LessonApi = useMemo(
    () => ({
      setCheck: (fn) => {
        checkRef.current = fn;
        setCanCheck(!!fn);
      },
      setReplay: (fn) => {
        replayRef.current = fn;
      },
      answer: handleOutcome,
      locked: !!outcome,
      quiet,
    }),
    [handleOutcome, outcome, quiet],
  );

  const goQuiet = async () => {
    await setQuietUntil(Date.now() + 3600_000);
    stop();
    // Drop the audio-only exercises still ahead (including this one if unanswered).
    setQueue((q) => {
      const keepUpTo = outcome ? pos + 1 : pos;
      const rest = q.slice(keepUpTo).filter((e) => !AUDIO_ONLY.has(e.ex.kind));
      for (const e of q.slice(keepUpTo)) if (AUDIO_ONLY.has(e.ex.kind)) passed.current.add(e.origin);
      const next = [...q.slice(0, keepUpTo), ...rest];
      if (keepUpTo >= next.length) setTimeout(finish, 0);
      return next;
    });
    if (!outcome) {
      setCanCheck(false);
      checkRef.current = null;
    }
  };

  const noSpeaking = async () => {
    await setSpeakPausedUntil(Date.now() + 3600_000);
    stop();
    setQueue((q) => {
      const next = q.filter((e, i) => i < pos || e.ex.kind !== 'repeat');
      for (const e of q) if (e.ex.kind === 'repeat') passed.current.add(e.origin);
      if (pos >= next.length) setTimeout(finish, 0);
      return next;
    });
    setCanCheck(false);
    checkRef.current = null;
  };

  const progress = exercises.length ? passed.current.size / exercises.length : 0;

  if (!current) return null;
  const isIntro = current.ex.kind === 'intro' || current.ex.kind === 'repeat';
  const hasSpeaking = queue.slice(pos).some((e) => e.ex.kind === 'repeat');

  return (
    <LessonCtx.Provider value={api}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <button onClick={onExit} aria-label="Leave lesson" className="rounded-full p-2 text-muted hover:bg-sunk">
            <Close className="h-6 w-6" />
          </button>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label={title} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="relative h-full rounded-full bg-jade transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            >
              <span aria-hidden className="absolute inset-x-1.5 top-[3px] h-[3px] rounded-full bg-white/30" />
            </div>
          </div>
          {hasSpeaking && (
            <button onClick={noSpeaking} title="Can't speak now (1 hour)" aria-label="Can't speak now: skip speaking exercises for an hour" className="rounded-full p-2 text-muted hover:bg-sunk">
              <MicOff className="h-6 w-6" />
            </button>
          )}
          {!quiet && (
            <button onClick={goQuiet} title="Can't listen now (1 hour)" aria-label="Can't listen now: skip audio exercises for an hour" className="rounded-full p-2 text-muted hover:bg-sunk">
              <Headphones className="h-6 w-6" />
            </button>
          )}
        </header>

        <main className="anim-slide flex-1 px-4 pb-48 pt-4" key={current.ex.key}>
          {current.retry > 0 && !outcome && <p className="mb-3 text-sm font-medium text-gold">Another go at one you missed</p>}
          <ExerciseView ex={current.ex} />
        </main>

        {!outcome && (
          <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
            <div className="mx-auto max-w-xl">
              {current.ex.kind !== 'match-pairs' && (
                <button
                  onClick={doCheck}
                  disabled={!canCheck}
                  className="press h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted"
                >
                  {isIntro ? 'Continue' : 'Check'}
                </button>
              )}
            </div>
          </footer>
        )}
        {outcome && (
          <Feedback
            outcome={outcome}
            ex={current.ex}
            onContinue={advance}
            onOverride={mode === 'testout' ? undefined : override}
            grade={mode === 'testout' || !graded ? undefined : <GradeChip rating={graded.rating} onChange={changeGrade} />}
          />
        )}
      </div>
    </LessonCtx.Provider>
  );
}

const TONE: Record<Verdict, { title: string; cls: string; btn: string; badge: string }> = {
  correct: { title: 'Correct!', cls: 'bg-jade-soft', btn: 'bg-jade text-jade-ink', badge: 'bg-jade text-jade-ink' },
  typo: { title: 'Correct, but mind the typo', cls: 'bg-jade-soft', btn: 'bg-jade text-jade-ink', badge: 'bg-jade text-jade-ink' },
  almost: { title: 'Almost!', cls: 'bg-amber-soft', btn: 'bg-gold text-white dark:text-black', badge: 'bg-gold text-white dark:text-black' },
  wrong: { title: 'Not quite', cls: 'bg-cinnabar-soft', btn: 'bg-cinnabar text-white dark:text-black', badge: 'bg-cinnabar text-white dark:text-black' },
};

function Feedback({
  outcome,
  ex,
  onContinue,
  onOverride,
  grade,
}: {
  outcome: Outcome;
  ex: Exercise;
  onContinue: () => void;
  onOverride?: () => void;
  grade?: ReactNode;
}) {
  const t = TONE[outcome.verdict];
  const a = outcome.answer;
  // Play the answer that's shown: for conversation exercises that's the reply, not the line you heard.
  const isReply = ex.kind === 'what-would-you-say' || ex.kind === 'reply-type';
  const audioId = isReply ? itemsOf(ex)[0] : (audioOf(ex)[0] ?? itemsOf(ex)[0]);
  const voice = isReply && ex.voice ? (ex.voice === 'f' ? 'm' : 'f') : ex.voice;
  const showAnswer = a && (outcome.verdict !== 'correct' || a.hanzi);
  return (
    <div role="status" aria-live="polite" className={`anim-rise fixed inset-x-0 bottom-0 z-20 rounded-t-3xl ${t.cls} px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgb(0_0_0/0.08)]`}>
      <div className="mx-auto max-w-xl">
        <p className="flex items-center gap-2.5 text-xl font-bold">
          <span aria-hidden className={`anim-pop flex h-8 w-8 shrink-0 items-center justify-center rounded-full [animation-delay:120ms] ${t.badge}`}>
            {outcome.verdict === 'wrong' ? <Close className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          </span>
          {t.title}
        </p>
        {outcome.note && <p className="mt-1 text-sm">{outcome.note}</p>}
        {outcome.syllables && outcome.verdict !== 'correct' && <SyllableBreakdown syllables={outcome.syllables} extra={outcome.extra} />}
        {showAnswer && (
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {a.hanzi && a.pinyin && <ToneText hanzi={a.hanzi} pinyin={a.pinyin} className="han block text-2xl" />}
              {a.pinyin && <TonePinyin pinyin={a.pinyin} className="block text-lg" />}
              {a.english && <p className="text-base opacity-80">{a.english}</p>}
              {a.text && <p>{a.text}</p>}
            </div>
            {audioId && (
              <button onClick={() => play(audioId, { voice })} aria-label="Play again" className="rounded-full bg-surface/70 p-3 transition active:scale-90">
                <Speaker className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        {grade}
        <button ref={focusNoScroll} onClick={onContinue} className={`press mt-4 h-14 w-full rounded-2xl text-lg font-semibold ${t.btn}`}>
          {outcome.verdict === 'wrong' ? 'Got it' : 'Continue'}
        </button>
        {outcome.verdict === 'wrong' && outcome.canOverride && onOverride && (
          <button onClick={onOverride} className="mt-2 h-11 w-full rounded-2xl text-sm font-medium opacity-80 hover:opacity-100">
            I was right: my answer means the same
          </button>
        )}
      </div>
    </div>
  );
}
