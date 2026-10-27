/**
 * Tone Gym: 20-item rounds of tone ear-training (single tones, tone pairs,
 * tone changes), with several speakers, weighted to what you mix up most.
 * Answers are logged with their tones, which feeds the confusion matrix.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Speaker } from '../../components/icons';
import { TonePinyin } from '../../components/Hanzi';
import { db, uuid } from '../../db/db';
import { playUrl, stop } from '../../lib/audio';
import { markSyllable, type Tone } from '../../lib/pinyin';
import { go } from '../../lib/router';
import { sfx } from '../../lib/sfx';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';
import { buildPool, MODES, patternLabel, patternStats, pickRound, ROUND, TONE_WORD, weakestPair, type GymItem, type GymMode } from './model';
import { ToneMatrix } from './ToneMatrix';

const BASE = import.meta.env.BASE_URL;
const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];
const WEEK = 7 * 864e5;

export function ToneGymRoute({ route }: { route: string[] }) {
  const mode = route[1] as GymMode | undefined;
  return mode && MODES.some((m) => m.id === mode) ? <Round key={mode} mode={mode} /> : <GymHome />;
}

function useToneLogs(since = 0) {
  return useLive(() => db.reviewLogs.where('at').above(since).filter((l) => !!l.tones && !l.replaced).toArray(), [since], null);
}

function GymHome() {
  const logs = useToneLogs();
  const weekAgo = useMemo(() => Date.now() - WEEK, []);
  const scores = useLive(() => db.gameScores.where('id').startsWith('tonegym:').toArray(), [], []);
  const best = new Map(scores.map((s) => [s.id, s.best]));
  const weak = logs ? weakestPair(patternStats(logs.filter((l) => l.at > weekAgo))) : null;
  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold">Tone Gym</h1>
      <p className="mt-1 text-muted">Short rounds of {ROUND}. Hearing many voices and words trains your ear fastest.</p>
      {weak && (
        <p className="mt-4 rounded-2xl bg-amber-soft p-4">
          Weakest pair this week: <span className="font-bold tabular-nums">{patternLabel(weak.pattern)}</span>, missed {Math.round(weak.error * 100)}% of the time.
          Workouts drill it more often.
        </p>
      )}
      <ul className="stagger mt-5 flex flex-col gap-3">
        {MODES.map((m, i) => (
          <li key={m.id}>
            <button
              onClick={() => go(`tone-gym/${m.id}`)}
              className={`press flex w-full items-center gap-4 rounded-2xl p-4 text-left ${i === 0 ? 'bg-jade text-jade-ink' : 'border-2 border-line bg-surface'}`}
            >
              <span className="flex-1">
                <span className="block font-semibold">{m.title}</span>
                <span className={`block text-sm ${i === 0 ? 'opacity-90' : 'text-muted'}`}>{m.blurb}</span>
              </span>
              <span className="text-right">
                <span className={`block text-xs ${i === 0 ? 'opacity-80' : 'text-muted'}`}>Best</span>
                <span className="block text-xl font-bold tabular-nums">
                  {best.get(`tonegym:${m.id}`) ?? 0}/{ROUND}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-semibold">Your tone matrix</h2>
      <p className="mb-3 text-sm text-muted">
        Each row is the tone it really was; the columns show what you heard or typed. Mix-ups are red. From the Tone Gym, tone exercises and every typed answer.
      </p>
      {logs ? <ToneMatrix logs={logs} /> : <p className="text-muted">Loading…</p>}
    </div>
  );
}

interface Answer {
  item: GymItem;
  given: Tone[];
  right: boolean;
}

function Round({ mode }: { mode: GymMode }) {
  const vocab = useVocab();
  const logs = useToneLogs(Date.now() - 60 * 864e5);
  const [items, setItems] = useState<GymItem[] | null>(null);
  const [pool, setPool] = useState<GymItem[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<Array<Tone | null>>([null, null]);
  const [speaker, setSpeaker] = useState(0);
  const shownAt = useRef(Date.now());
  const started = useRef(Date.now());

  // Build the round once the word list and history are in.
  useEffect(() => {
    if (!vocab || !logs || items) return;
    const p = buildPool(vocab, BASE);
    setPool(p);
    setItems(pickRound(p, mode, patternStats(logs)));
  }, [vocab, logs, items, mode]);

  const item = items?.[i];
  const answer = answers.length > i ? answers[i] : null;
  const done = !!items && i >= items.length;

  const playSource = useCallback(
    async (it: GymItem, k: number) => {
      // Try speakers in turn from k until one plays.
      for (let j = 0; j < it.sources.length; j++) {
        const s = (k + j) % it.sources.length;
        if (await playUrl(it.sources[s].url)) {
          setSpeaker(s);
          return;
        }
      }
    },
    [],
  );

  // New item: a random speaker, played straight away.
  useEffect(() => {
    if (!item) return;
    const k = Math.floor(Math.random() * item.sources.length);
    setSpeaker(k);
    setPicked([null, null]);
    shownAt.current = Date.now();
    void playSource(item, k);
  }, [item, playSource]);
  useEffect(() => () => stop(), []);

  const submit = useCallback(
    (given: Tone[]) => {
      if (!item || answer) return;
      const right = given.every((t, k) => t === item.tones[k]);
      setAnswers((a) => [...a, { item, given, right }]);
      if (right) sfx.correct();
      else {
        sfx.wrong();
        // Hear the right one again straight away.
        setTimeout(() => void playSource(item, speaker), 350);
      }
      const now = Date.now();
      void db.reviewLogs.add({
        id: uuid(),
        itemId: item.word,
        exercise: `tonegym:${mode}`,
        verdict: right ? 'correct' : 'wrong',
        at: now,
        ms: now - shownAt.current,
        tones: { expected: item.tones.join('-'), given: given.join('-') },
        updatedAt: now,
      });
    },
    [item, answer, mode, playSource, speaker],
  );

  const pick = useCallback(
    (slot: number, t: Tone) => {
      if (!item || answer) return;
      const next = [...picked];
      next[slot] = t;
      setPicked(next);
      if (next.slice(0, item.tones.length).every((x) => x !== null)) submit(next.slice(0, item.tones.length) as Tone[]);
    },
    [item, answer, picked, submit],
  );

  const next = useCallback(() => setI((x) => x + 1), []);

  // Keyboard: space replays, digits pick tones (1–4, 5 or 0 neutral), Enter continues.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === ' ') {
        e.preventDefault();
        void playSource(item, speaker);
      } else if (e.key === 'Enter' && answer) {
        e.preventDefault();
        next();
      } else if (/^[0-5]$/.test(e.key) && !answer) {
        const t = (e.key === '0' ? 5 : Number(e.key)) as Tone;
        if (t === 5 && (item.tones.length === 1 || picked[0] === null)) return;
        pick(picked[0] === null ? 0 : 1, t);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!items) return <p className="p-8 text-center text-muted">Getting the round ready…</p>;
  if (!items.length)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p>No recordings for this drill yet. New recordings arrive every few hours; try again later.</p>
        <button onClick={() => go('tone-gym')} className="mt-4 h-12 rounded-2xl border-2 border-line px-6 font-medium">
          Back
        </button>
      </div>
    );
  if (done)
    return (
      <RoundEnd
        mode={mode}
        answers={answers}
        ms={Date.now() - started.current}
        onAgain={() => {
          started.current = Date.now();
          setAnswers([]);
          setI(0);
          setItems(null);
        }}
      />
    );

  const title = MODES.find((m) => m.id === mode)!.title;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button onClick={() => go('tone-gym')} aria-label="Leave the round" className="rounded-full p-2 text-muted hover:bg-sunk">
          ✕
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={i} aria-valuemax={items.length} aria-label={title}>
          <div className="h-full rounded-full bg-jade transition-[width] duration-300" style={{ width: `${(i / items.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {answers.filter((a) => a.right).length}/{items.length}
        </span>
      </header>

      <div className="mt-10 flex flex-col items-center">
        <button
          onClick={() => item && void playSource(item, speaker)}
          aria-label="Play again"
          className="press flex h-24 w-24 items-center justify-center rounded-full bg-jade text-jade-ink"
        >
          <Speaker className="h-10 w-10" />
        </button>
        {item!.sources.length > 1 && (
          <button onClick={() => item && void playSource(item, (speaker + 1) % item.sources.length)} className="mt-3 text-sm font-medium text-jade">
            Another voice ({item!.sources.length} voices)
          </button>
        )}
        <p className="mt-6 text-3xl font-semibold tracking-wide" aria-label="Syllables">
          {item!.bases.map((b) => b.replace(/v/g, 'ü')).join(' ')}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {item!.tones.map((_, slot) => (
          <div key={slot}>
            {item!.tones.length > 1 && <p className="mb-1.5 text-sm text-muted">{slot === 0 ? 'First syllable' : 'Second syllable'}</p>}
            <div className={`grid gap-2 ${slot === 1 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {([1, 2, 3, 4, 5] as Tone[])
                .filter((t) => t !== 5 || slot === 1)
                .map((t) => {
                  const chosen = picked[slot] === t;
                  const isRight = answer && item!.tones[slot] === t;
                  const isWrongPick = answer && chosen && !isRight;
                  return (
                    <button
                      key={t}
                      onClick={() => pick(slot, t)}
                      disabled={!!answer}
                      aria-label={`${TONE_WORD[t]} tone`}
                      aria-pressed={chosen}
                      className={`flex h-16 flex-col items-center justify-center rounded-2xl border-2 text-xl font-semibold transition active:scale-95 ${TONE_TEXT[t]} ${
                        isRight ? 'border-jade bg-jade-soft' : isWrongPick ? 'border-cinnabar bg-cinnabar-soft' : chosen ? 'border-ink bg-surface' : 'border-line bg-surface'
                      }`}
                    >
                      {markSyllable({ base: item!.bases[slot], tone: t })}
                      <span className="text-[10px] font-normal text-muted">{t === 5 ? '0' : t}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {answer && <Feedback answer={answer} pool={pool} onNext={next} onReplay={() => void playSource(answer.item, speaker)} />}
    </div>
  );
}

function Feedback({ answer, pool, onNext, onReplay }: { answer: Answer; pool: GymItem[]; onNext: () => void; onReplay: () => void }) {
  const { item, given, right } = answer;
  // What you thought you heard: the same syllables with your tones if a recording exists, else any word with that tone pattern.
  const yours = useMemo(() => {
    if (right) return null;
    const pattern = given.join('-');
    const same = pool.find((x) => x.pattern === pattern && x.bases.join() === item.bases.join());
    return same ?? pool.find((x) => x.pattern === pattern) ?? null;
  }, [right, given, pool, item]);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div role="status" aria-live="polite" className={`anim-rise fixed inset-x-0 bottom-0 z-20 rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 ${right ? 'bg-jade-soft' : 'bg-cinnabar-soft'}`}>
      <div className="mx-auto max-w-xl">
        <p className="text-xl font-bold">{right ? 'Right' : `It was ${patternLabel(item.pattern)}, not ${patternLabel(given.join('-'))}`}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <TonePinyin pinyin={item.pinyin} className="text-2xl font-semibold" />
          <span className="text-sm opacity-80">{item.gloss}</span>
        </p>
        {item.sandhi && (
          <p className="mt-1 text-sm">
            Spoken <span className="font-semibold">{item.sandhi.spoken}</span>. {item.sandhi.why}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onReplay} className="flex h-11 items-center gap-2 rounded-xl bg-surface/70 px-3 font-medium">
            <Speaker className="h-5 w-5" /> Hear it again
          </button>
          {yours && (
            <button onClick={() => void playUrl(yours.sources[0].url)} className="flex h-11 items-center gap-2 rounded-xl bg-surface/70 px-3 font-medium">
              <Speaker className="h-5 w-5" /> What {patternLabel(given.join('-'))} sounds like ({yours.pinyin})
            </button>
          )}
        </div>
        <button ref={btn} onClick={onNext} className="press mt-4 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Continue
        </button>
      </div>
    </div>
  );
}

function RoundEnd({ mode, answers, ms, onAgain }: { mode: GymMode; answers: Answer[]; ms: number; onAgain: () => void }) {
  const score = answers.filter((a) => a.right).length;
  const [prevBest, setPrevBest] = useState<number | null>(null);
  useEffect(() => {
    sfx.finish();
    void (async () => {
      const id = `tonegym:${mode}`;
      const row = await db.gameScores.get(id);
      setPrevBest(row?.best ?? 0);
      await db.gameScores.put({ id, best: Math.max(row?.best ?? 0, score), plays: (row?.plays ?? 0) + 1, updatedAt: Date.now() });
    })();
  }, [mode, score]);
  const logs = answers.map((a) => ({ tones: { expected: a.item.tones.join('-'), given: a.given.join('-') } }));
  const weak = weakestPair(patternStats(logs));
  const missed = answers.filter((a) => !a.right);
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-8">
      <p className="text-center text-6xl font-bold tabular-nums">
        {score}
        <span className="text-3xl text-muted">/{answers.length}</span>
      </p>
      <p className="mt-2 text-center text-muted">
        {prevBest !== null && score > prevBest ? 'New personal best!' : `Personal best ${Math.max(prevBest ?? 0, score)}`} · {Math.round(ms / 1000)} s
      </p>
      {weak && <p className="mt-4 rounded-2xl bg-amber-soft p-4 text-center">Weakest pair this round: <span className="font-bold">{patternLabel(weak.pattern)}</span></p>}
      {missed.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">Missed</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {missed.map((a, k) => (
              <li key={k} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <button onClick={() => void playUrl(a.item.sources[0].url)} aria-label={`Play ${a.item.pinyin}`} className="rounded-full bg-jade-soft p-2 text-jade">
                  <Speaker className="h-4 w-4" />
                </button>
                <TonePinyin pinyin={a.item.pinyin} className="text-lg font-semibold" />
                <span className="text-sm text-muted">you: {patternLabel(a.given.join('-'))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="mt-6 font-semibold">This round</h2>
      <div className="mt-2">
        <ToneMatrix logs={logs} />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <button onClick={() => go(`tone-gym`)} className="h-12 rounded-2xl border-2 border-line font-medium">
          Back to the Tone Gym
        </button>
        <button onClick={onAgain} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Another round
        </button>
      </div>
    </div>
  );
}
