import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToneText, TonePinyin } from '../../components/Hanzi';
import { Close, Headphones, MicOff, Speaker } from '../../components/icons';
import { preload, play, stop } from '../../lib/audio';
import { isPass, type Verdict } from '../../lib/pinyinAnswer';
import { setQuietUntil, setSpeakPausedUntil, useQuietUntil } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { shuffle } from '../../lib/random';
import { recordAnswer } from '../../lib/srs';
import { audioOf, ExerciseView, itemsOf } from '../exercises/ExerciseView';
import { LessonCtx, type LessonApi } from './context';
import { AUDIO_ONLY, type Exercise, type Outcome } from './types';

export interface LessonResult {
  accuracy: number; // first-attempt pass rate, 0 to 1
  ms: number;
  newWords: string[];
  mistakes: string[]; // item ids answered wrong at least once
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

  const finish = useCallback(() => {
    const scored = [...firstResults.current.values()];
    const ok = scored.filter(isPass).length;
    sfx.finish();
    onFinish({
      accuracy: scored.length ? ok / scored.length : 1,
      ms: Date.now() - started.current,
      newWords: exercises.filter((e) => e.kind === 'intro').map((e) => (e as Extract<Exercise, { kind: 'intro' }>).wordId),
      mistakes: [...mistakes.current],
      total: scoredTotal,
    });
  }, [exercises, onFinish, scoredTotal]);

  const advance = useCallback(() => {
    stop();
    setOutcome(null);
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
        for (const it of items) void recordAnswer(it.id, it.verdict, { exercise: ex.kind, nodeId, tones: o.tones });
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
            <div className="h-full rounded-full bg-jade transition-all duration-500" style={{ width: `${Math.max(4, progress * 100)}%` }} />
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

        <main className="flex-1 px-4 pb-48 pt-4" key={current.ex.key}>
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
                  className="h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink shadow-sm transition active:scale-[0.99] disabled:bg-sunk disabled:text-muted disabled:shadow-none"
                >
                  {isIntro ? 'Continue' : 'Check'}
                </button>
              )}
            </div>
          </footer>
        )}
        {outcome && <Feedback outcome={outcome} ex={current.ex} onContinue={advance} />}
      </div>
    </LessonCtx.Provider>
  );
}

const TONE: Record<Verdict, { title: string; cls: string; btn: string }> = {
  correct: { title: 'Correct!', cls: 'bg-jade-soft', btn: 'bg-jade text-jade-ink' },
  typo: { title: 'Correct, but mind the typo', cls: 'bg-jade-soft', btn: 'bg-jade text-jade-ink' },
  almost: { title: 'Almost!', cls: 'bg-amber-soft', btn: 'bg-gold text-white dark:text-black' },
  wrong: { title: 'Not quite', cls: 'bg-cinnabar-soft', btn: 'bg-cinnabar text-white dark:text-black' },
};

function Feedback({ outcome, ex, onContinue }: { outcome: Outcome; ex: Exercise; onContinue: () => void }) {
  const t = TONE[outcome.verdict];
  const a = outcome.answer;
  // Play the answer that's shown: for conversation exercises that's the reply, not the line you heard.
  const isReply = ex.kind === 'what-would-you-say' || ex.kind === 'reply-type';
  const audioId = isReply ? itemsOf(ex)[0] : (audioOf(ex)[0] ?? itemsOf(ex)[0]);
  const voice = isReply && ex.voice ? (ex.voice === 'f' ? 'm' : 'f') : ex.voice;
  const showAnswer = a && (outcome.verdict !== 'correct' || a.hanzi);
  return (
    <div role="status" aria-live="polite" className={`anim-rise fixed inset-x-0 bottom-0 z-20 ${t.cls} px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5`}>
      <div className="mx-auto max-w-xl">
        <p className="text-xl font-bold">{t.title}</p>
        {outcome.note && <p className="mt-1 text-sm">{outcome.note}</p>}
        {showAnswer && (
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {a.hanzi && a.pinyin && <ToneText hanzi={a.hanzi} pinyin={a.pinyin} className="han block text-2xl" />}
              {a.pinyin && <TonePinyin pinyin={a.pinyin} className="block text-lg" />}
              {a.english && <p className="text-base opacity-80">{a.english}</p>}
              {a.text && <p>{a.text}</p>}
            </div>
            {audioId && (
              <button onClick={() => play(audioId, { voice })} aria-label="Play again" className="rounded-full bg-surface/70 p-3">
                <Speaker className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        <button autoFocus onClick={onContinue} className={`mt-4 h-14 w-full rounded-2xl text-lg font-semibold ${t.btn}`}>
          {outcome.verdict === 'wrong' ? 'Got it' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
