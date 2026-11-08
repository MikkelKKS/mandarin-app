/**
 * Tone Gym: 20-item rounds of tone ear-training (single tones, tone pairs,
 * tone changes), with several speakers, weighted to what you mix up most.
 * Answers are logged with their tones, which feeds the confusion matrix.
 */
import { DictionaryButton } from '../../components/LookUp';
import { VolumeSlider } from '../../components/VolumeSlider';
import { PageHeader } from '../../components/PageHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Speaker } from '../../components/icons';
import { ToneContour } from '../../components/ToneContour';
import { PitchStaff } from '../../components/PitchStaff';
import { TonePinyin } from '../../components/Hanzi';
import { db, uuid } from '../../db/db';
import { playUrl, stop } from '../../lib/audio';
import { markSyllable, type Tone } from '../../lib/pinyin';
import { go } from '../../lib/router';
import { sfx } from '../../lib/sfx';
import { useLive } from '../../lib/useLive';
import { useVocab } from '../../lib/vocabData';
import { buildPool, GAVE_UP_TONES, MODES, patternLabel, patternStats, pickRound, ROUND, TONE_WORD, toneMatrix, weakestPair, type GymItem, type GymMode } from './model';
import { ToneMatrix } from './ToneMatrix';
import { useLeave } from '../../components/sheetLeave';

const BASE = import.meta.env.BASE_URL;
const TONE_TEXT = ['', 'text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5'];
const WEEK = 7 * 864e5;

export function ToneGymRoute({ route }: { route: string[] }) {
  // Old links to the removed pair and tone-change rounds open a workout.
  const mode = route[1] ? ((MODES.some((m) => m.id === route[1]) ? route[1] : 'mixed') as GymMode) : undefined;
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
  const workout = MODES[0];
  const others = MODES.slice(1);
  const bestOf = (id: string) => (best.has(`tonegym:${id}`) ? `${best.get(`tonegym:${id}`)}/${ROUND}` : '–');
  return (
    <div className="pb-10">
      <PageHeader title="Tone Gym">Rounds of {ROUND}, from six native speakers.</PageHeader>
      <div className="mt-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <button onClick={() => go(`tone-gym/${workout.id}`)} className="press w-full rounded-plate bg-plate p-5 text-left text-plate-ink shadow-md dark:border dark:border-jade/40 md:p-6">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-title font-semibold">{workout.title}</span>
              <span className="text-sm opacity-85">
                Best <span className="num text-xl">{bestOf(workout.id)}</span>
              </span>
            </span>
            {weak ? (
              <span className="mt-4 flex items-center gap-4">
                <span className="flex items-center gap-2 rounded-control bg-surface px-3 py-2" aria-hidden>
                  {weak.pattern.split('-').map((t, k) => (
                    <ToneContour key={k} tone={Number(t)} className={`h-6 w-10 ${TONE_TEXT[Number(t)]}`} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="num block text-4xl leading-none">{patternLabel(weak.pattern)}</span>
                  <span className="block text-sm opacity-85">your weakest pair, missed {Math.round(weak.error * 100)}%</span>
                </span>
              </span>
            ) : (
              <span className="mt-2 block opacity-85">{workout.blurb}</span>
            )}
            <span className="mt-4 block text-sm opacity-85">{weak ? 'Workouts drill it more often.' : 'Start a round'}</span>
          </button>
          <ul className="group-list mt-4">
            {others.map((m) => (
              <li key={m.id}>
                <button onClick={() => go(`tone-gym/${m.id}`)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-sunk/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.title}</span>
                    <span className="block text-sm text-muted">{m.blurb}</span>
                  </span>
                  <span className="text-right text-sm text-muted">
                    Best <span className="num block text-xl text-ink">{bestOf(m.id)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <section className="card mt-6 p-4 md:p-5 lg:mt-0" aria-label="Your tone matrix">
          <h2 className="text-title font-semibold">Your tone matrix</h2>
          {logs && toneMatrix(logs).flat().some(Boolean) && <p className="mb-3 mt-0.5 text-sm text-muted">Rows: the tone it really was. Columns: what you heard or typed.</p>}
          {logs ? <ToneMatrix logs={logs} /> : <p className="text-muted">Loading…</p>}
          <p className="mt-4 text-sm text-muted">Single tones are recorded by six native speakers (Tone Perfect, Michigan State University Libraries).</p>
        </section>
      </div>
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
      // given = [] is "I don't know".
      const right = given.length > 0 && given.every((t, k) => t === item.tones[k]);
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
        tones: { expected: item.tones.join('-'), given: given.length ? given.join('-') : GAVE_UP_TONES },
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
  const [leaving, leave] = useLeave();

  // Keyboard: space replays, digits 1–4 pick tones, Enter continues.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === ' ') {
        e.preventDefault();
        void playSource(item, speaker);
      } else if (e.key === 'Enter' && answer) {
        e.preventDefault();
        leave(next);
      } else if (/^[1-4]$/.test(e.key) && !answer) {
        const t = Number(e.key) as Tone;
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
        <button onClick={() => go('tone-gym')} className="mt-4 h-12 rounded-2xl border border-line px-6 font-medium">
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
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={i} aria-valuemax={items.length} aria-label={title}>
          <div className="h-full rounded-full bg-jade transition-[width] duration-300" style={{ width: `${(i / items.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {answers.filter((a) => a.right).length}/{items.length}
        </span>
        <DictionaryButton className="-mr-2" />
      </header>

      <div className="mt-10 flex flex-col items-center">
        <button
          onClick={() => item && void playSource(item, speaker)}
          aria-label="Play again"
          className="press flex h-24 w-24 items-center justify-center rounded-full bg-jade text-jade-ink"
        >
          <Speaker className="h-10 w-10" />
        </button>
        <div className="mt-2 flex items-center gap-2">
          {item!.sources.length > 1 && (
            <button onClick={() => item && void playSource(item, (speaker + 1) % item.sources.length)} className="px-2 py-2 text-sm font-medium text-jade">
              Another voice ({item!.sources.length} voices)
            </button>
          )}
          <VolumeSlider compact />
        </div>
        <p className="mt-4 text-center text-hero font-semibold tracking-wide lg:text-numeral" aria-label="Syllables">
          {item!.bases.map((b) => b.replace(/v/g, 'ü')).join(' ')}
        </p>
        <div className="relative mt-1 h-14 w-full max-w-[16rem]" aria-hidden>
          {answer && item!.tones.length === 1 && answer.given[0] && answer.given[0] !== item!.tones[0] && <PitchStaff tone={answer.given[0]} dashed lines={false} aspect={256 / 56} className="absolute inset-0 h-full w-full" />}
          <PitchStaff tone={answer && item!.tones.length === 1 ? item!.tones[0] : undefined} draw={!!answer} aspect={256 / 56} className="absolute inset-0 h-full w-full" />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {item!.tones.map((_, slot) => (
          <div key={slot}>
            {item!.tones.length > 1 && <p className="mb-1.5 text-sm text-muted">{slot === 0 ? 'First syllable' : 'Second syllable'}</p>}
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as Tone[]).map((t) => {
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
                      className={`flex h-16 flex-col items-center justify-center rounded-2xl border text-xl font-semibold transition active:scale-95 ${TONE_TEXT[t]} ${
                        isRight ? 'border-jade bg-jade-soft anim-nudge !duration-0' : isWrongPick ? 'opt-miss anim-shake !duration-0' : chosen ? 'border-ink bg-surface' : 'border-edge bg-surface'
                      }`}
                    >
                      {markSyllable({ base: item!.bases[slot], tone: t })}
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted">
                        <PitchStaff tone={t} aspect={2} className="h-5 w-10" />
                        {t}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {!answer && (
        <button onClick={() => submit([])} className="btn btn-quiet mt-4 h-12 w-full text-base">
          I don't know
        </button>
      )}

      {answer && <Feedback answer={answer} pool={pool} voice={answer.item.sources[speaker]?.speaker} onNext={() => leave(next)} leaving={leaving} onReplay={() => void playSource(answer.item, speaker)} />}
    </div>
  );
}

function Feedback({ answer, pool, voice, onNext, leaving = false, onReplay }: { answer: Answer; pool: GymItem[]; voice?: string; onNext: () => void; leaving?: boolean; onReplay: () => void }) {
  const { item, given, right } = answer;
  // What you thought you heard: the same syllables with your tones if a recording exists, else any word with that tone pattern.
  const yours = useMemo(() => {
    if (right || !given.length) return null;
    const pattern = given.join('-');
    const same = pool.find((x) => x.pattern === pattern && x.bases.join() === item.bases.join());
    return same ?? pool.find((x) => x.pattern === pattern) ?? null;
  }, [right, given, pool, item]);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div role="status" aria-live="polite" className={`${leaving ? 'anim-sheet-out' : 'anim-rise'} fixed inset-x-0 bottom-0 z-20 rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 ${right ? 'bg-jade-soft' : 'sheet-miss'}`}>
      <div className="sheet-stagger mx-auto max-w-xl">
        <p className="text-xl font-semibold">{right ? 'Right' : given.length ? `It was ${patternLabel(item.pattern)}, not ${patternLabel(given.join('-'))}` : `It was ${patternLabel(item.pattern)}`}</p>
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
          <button onClick={onReplay} className="flex h-11 items-center gap-2 rounded-xl border border-edge bg-surface px-3 font-medium">
            <Speaker className="h-5 w-5" /> Hear it again
          </button>
          {yours && (
            <button onClick={() => void playUrl((yours.sources.find((x) => x.speaker === voice) ?? yours.sources[0]).url)} className="flex h-11 items-center gap-2 rounded-xl border border-edge bg-surface px-3 font-medium">
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
  const logs = answers.map((a) => ({ tones: { expected: a.item.tones.join('-'), given: a.given.length ? a.given.join('-') : GAVE_UP_TONES } }));
  const weak = weakestPair(patternStats(logs));
  const missed = answers.filter((a) => !a.right);
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-8">
      <p className="text-center text-6xl font-semibold tabular-nums">
        {score}
        <span className="text-3xl text-muted">/{answers.length}</span>
      </p>
      <p className="mt-2 text-center text-muted">
        {prevBest !== null && score > prevBest ? (
          <span className="anim-pop inline-block font-semibold text-imperial [animation-delay:200ms]">New personal best!</span>
        ) : (
          `Personal best ${Math.max(prevBest ?? 0, score)}`
        )}{' '}
        · {Math.round(ms / 1000)} s
      </p>
      {weak && <p className="mt-4 card p-4 text-center">Weakest pair this round: <span className="font-semibold">{patternLabel(weak.pattern)}</span></p>}
      {missed.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">Missed</h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {missed.map((a, k) => (
              <li key={k} className="flex min-w-0 items-center gap-2 rounded-xl bg-surface px-2.5 py-2">
                <button onClick={() => void playUrl(a.item.sources[0].url)} aria-label={`Play ${a.item.pinyin}`} className="rounded-full bg-jade-soft p-2 text-jade">
                  <Speaker className="h-4 w-4" />
                </button>
                <span className="min-w-0">
                  <TonePinyin pinyin={a.item.pinyin} className="block truncate text-lg font-semibold" />
                  <span className="block text-xs text-muted">{a.given.length ? `you: ${patternLabel(a.given.join('-'))}` : "you didn't know"}</span>
                </span>
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
        <button onClick={() => go(`tone-gym`)} className="h-12 rounded-2xl border border-line font-medium">
          Back to the Tone Gym
        </button>
        <button onClick={onAgain} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Another round
        </button>
      </div>
    </div>
  );
}
