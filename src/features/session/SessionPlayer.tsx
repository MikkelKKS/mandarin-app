/**
 * Runs a quick or deep session: blocks of items, instant feedback, XP with a
 * combo multiplier, wrong answers asked again at the end of their block, and
 * the state saved after every answer so it can be resumed on either device.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { ReportAudio } from '../../components/ReportAudio';
import { Speaker } from '../../components/icons';
import { SyllableBreakdown } from '../../components/SyllableBreakdown';
import { db } from '../../db/db';
import { comboMultiplier, xpFor, XP } from '../../lib/gamify';
import { play, prefetchForOffline, stop } from '../../lib/audio';
import { isPass } from '../../lib/pinyinAnswer';
import { introduceWord, todaysQueue, type RatingName } from '../../lib/review';
import { go } from '../../lib/router';
import { micActive, useSettings } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { recordSessionAnswer, regradeAll } from '../../lib/srs';
import { loadVocabData, shortGloss, type VocabData } from '../../lib/vocabData';
import { LessonCtx, type LessonApi } from '../lesson/context';
import { GradeChip } from '../lesson/GradeChip';
import type { Outcome } from '../lesson/types';
import { buildPool, patternStats, pickRound } from '../tonegym/model';
import { SessionItem, type ItemResult } from './items';
import { BLOCK_TITLE, cardOf, planSession, type SItem, type SessionMode } from './plan';
import { SessionEnd } from './SessionEnd';
import { loadSession, saveSession, type SessionState } from './state';

const BASE = import.meta.env.BASE_URL;

/** Make a fresh session plan from today's queue. */
async function newSession(mode: SessionMode, s: { newPerDay: number; reviewsPerDay: number; speaking: boolean }, data: VocabData): Promise<SessionState> {
  const now = Date.now();
  const mic = micActive();
  const queue = await todaysQueue(data.words.map((w) => w.id), { newPerDay: s.newPerDay, reviewsPerDay: s.reviewsPerDay, mic }, now);
  const cards = await db.reviewItems.toArray();
  const started = new Set(cards.filter((c) => c.word && (c.reps > 0 || c.state !== 0)).map((c) => c.word!));
  // Speaking starts on words you already know by ear (listening card in review), most common first.
  const hasSpeaking = new Set(cards.filter((c) => c.facet === 'sp').map((c) => c.word));
  const order = new Map(data.words.map((w) => [w.id, w.order]));
  const speakNew = cards
    .filter((c) => c.facet === 'lm' && c.state === 2 && c.word && !hasSpeaking.has(c.word))
    .map((c) => c.word!)
    .sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
  const logs = await db.reviewLogs.where('at').above(now - 60 * 864e5).filter((l) => !!l.tones).toArray();
  const tones = pickRound(buildPool(data.words, BASE), 'mixed', patternStats(logs), Math.random, mode === 'quick' ? 6 : 20);
  const plan = planSession({ mode, reviews: queue.reviews, newWords: queue.newWords, data, started, tones, mic, speakNew, now });
  return { id: 'session', plan, block: 0, item: 0, xp: 0, combo: 0, bestCombo: 0, right: 0, answered: 0, newWords: [], tones: [], done: false, startedAt: now, updatedAt: now };
}

/** Audio for the whole session, fetched in the background so it works offline. */
function prefetchPlan(st: SessionState): void {
  const ids = new Set<string>();
  for (const b of st.plan.blocks)
    for (const it of b.items) {
      if ('word' in it) ids.add(it.word);
      if ('sentence' in it) ids.add(it.sentence);
    }
  void prefetchForOffline([...ids]);
  const urls = st.plan.blocks.flatMap((b) => b.items.flatMap((it) => (it.kind === 'tone' ? it.gym.sources.map((s) => s.url) : [])));
  for (const u of urls) fetch(u, { priority: 'low' } as RequestInit).catch(() => {});
}

export function SessionRoute({ route }: { route: string[] }) {
  const mode = route[1] as SessionMode | 'resume';
  const settings = useSettings();
  const [data, setData] = useState<VocabData | null>(null);
  const [st, setSt] = useState<SessionState | null>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      const d = await loadVocabData();
      const resumed = mode === 'resume' ? await loadSession() : null;
      const s = resumed ?? (await newSession(mode === 'deep' ? 'deep' : 'quick', settings, d));
      if (!live) return;
      setData(d);
      if (!s.plan.blocks.length) setEmpty(true);
      else {
        setSt(s);
        void saveSession(s);
        prefetchPlan(s);
      }
    })();
    return () => {
      live = false;
    };
    // Settings are read once, when the session is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  if (empty)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="han text-5xl text-jade">好</p>
        <h1 className="mt-4 text-xl font-bold">Nothing to do right now</h1>
        <p className="mt-2 text-muted">No reviews due and no new words left for today. The Tone Gym is always open.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={() => go('tone-gym')} className="press h-12 rounded-2xl bg-jade font-semibold text-jade-ink">
            Tone Gym
          </button>
          <button onClick={() => go('')} className="h-12 rounded-2xl border-2 border-line font-medium">
            Home
          </button>
        </div>
      </div>
    );
  if (!data || !st) return <p className="p-8 text-center text-muted">Putting your session together…</p>;
  return <Player data={data} initial={st} />;
}

function Player({ data, initial }: { data: VocabData; initial: SessionState }) {
  const [st, setSt] = useState(initial);
  const [result, setResult] = useState<ItemResult | null>(null);
  const [graded, setGraded] = useState<{ card: string; rating: RatingName } | null>(null);
  const [gained, setGained] = useState<number | null>(null);
  const [browserVoice, setBrowserVoice] = useState(false);
  const shownAt = useRef(Date.now());
  const checkRef = useRef<(() => Outcome | null) | null>(null);
  const replayRef = useRef<(() => void) | null>(null);

  const block = st.plan.blocks[st.block];
  const item: SItem | undefined = block?.items[st.item];
  const finished = st.done || !item;

  useEffect(() => {
    shownAt.current = Date.now();
    setBrowserVoice(false);
  }, [st.block, st.item]);
  useEffect(() => {
    const h = () => setBrowserVoice(true);
    window.addEventListener('audio:browser-voice', h);
    return () => {
      window.removeEventListener('audio:browser-voice', h);
      stop();
    };
  }, []);

  const persist = useCallback((next: SessionState) => {
    setSt(next);
    void saveSession(next);
  }, []);

  const advance = useCallback(() => {
    stop();
    setResult(null);
    setGraded(null);
    setGained(null);
    checkRef.current = null;
    let { block: b, item: i } = st;
    i++;
    if (i >= st.plan.blocks[b].items.length) {
      b++;
      i = 0;
    }
    const done = b >= st.plan.blocks.length;
    persist({ ...st, block: b, item: i, done });
  }, [st, persist]);

  const onResult = useCallback(
    (r: ItemResult) => {
      if (!item || result) return;
      const o = r.outcome;
      const ms = Date.now() - shownAt.current;
      const isIntro = item.kind === 'intro';
      // XP and combo (intros give a flat bonus and don't touch the combo).
      const pass = isPass(o.verdict);
      const combo = isIntro ? st.combo : pass ? st.combo + 1 : 0;
      const xp = isIntro ? XP.newWord : item.retry ? Math.round(xpFor(o.verdict, 0) / 2) : xpFor(o.verdict, st.combo, item.kind === 'tone' ? 'gym' : 'review');
      if (!isIntro) {
        if (o.verdict === 'wrong') sfx.wrong();
        else if (o.verdict === 'almost') sfx.almost();
        else sfx.correct();
      }
      // Record it.
      const card = cardOf(item);
      const exercise = item.kind === 'tone' ? 'tonegym:session' : item.kind;
      const itemId = 'word' in item ? item.word : 'sentence' in item ? item.sentence : item.kind === 'tone' ? item.gym.word : '';
      if (isIntro) {
        void introduceWord(item.word).then(() => recordSessionAnswer({ itemId, verdict: 'correct', exercise: 'intro', xp }));
      } else {
        void recordSessionAnswer({ card, itemId, verdict: o.verdict, rating: r.rating, exercise, ms, typed: r.typed, syllables: o.syllables?.length, tones: o.tones, xp }).then((rec) => {
          if (rec.card && rec.rating && !r.rating) setGraded({ card: rec.card, rating: rec.rating });
        });
      }
      // Wrong: ask again at the end of this block (once).
      const blocks = st.plan.blocks.map((bl) => ({ ...bl, items: [...bl.items] }));
      if (o.verdict === 'wrong' && !item.retry && item.kind !== 'intro' && item.kind !== 'sentence-meaning') blocks[st.block].items.push({ ...item, retry: true });
      const next: SessionState = {
        ...st,
        plan: { ...st.plan, blocks },
        xp: st.xp + xp,
        combo,
        bestCombo: Math.max(st.bestCombo, combo),
        right: st.right + (pass && !isIntro ? 1 : 0),
        answered: st.answered + (isIntro ? 0 : 1),
        newWords: isIntro ? [...st.newWords, item.word] : st.newWords,
        tones: o.tones ? [...st.tones, o.tones] : st.tones,
      };
      setGained(xp);
      if (r.skipFeedback) {
        // Self-graded and intro items move straight on.
        const b = next.block;
        let i = next.item + 1;
        let nb = b;
        if (i >= next.plan.blocks[b].items.length) {
          nb = b + 1;
          i = 0;
        }
        persist({ ...next, block: nb, item: i, done: nb >= next.plan.blocks.length });
        setTimeout(() => setGained(null), 900);
        return;
      }
      persist(next);
      setResult(r);
      // Play the right answer after a typed or chosen answer (words and sentences).
      if (item.kind !== 'tone' && o.verdict !== 'wrong') {
        const id = 'word' in item ? item.word : 'sentence' in item ? item.sentence : null;
        if (id && item.kind !== 'dictation' && item.kind !== 'sentence-dictation' && item.kind !== 'choose-meaning') void play(id);
      }
    },
    [item, result, st, persist],
  );

  /** "I was right": a differently worded typed answer counts as correct after all. */
  const override = useCallback(() => {
    if (!graded || !result) return;
    void regradeAll([graded.card], 'good').then(() => setGraded({ ...graded, rating: 'good' }));
    setResult({ ...result, outcome: { ...result.outcome, verdict: 'correct', note: 'Counted as correct.', canOverride: false } });
    // Drop the retry that was queued for it.
    const blocks = st.plan.blocks.map((bl, k) => (k === st.block ? { ...bl, items: bl.items.filter((x, j) => !(j > st.item && x.retry && JSON.stringify({ ...x, retry: undefined }) === JSON.stringify({ ...item, retry: undefined }))) } : bl));
    persist({ ...st, plan: { ...st.plan, blocks } });
  }, [graded, result, st, item, persist]);

  /** "No mic right now": take the speaking questions out of the rest of this session (skipped, not failed). */
  const noMic = useCallback(() => {
    stop();
    const blocks = st.plan.blocks.map((bl, k) =>
      k < st.block ? bl : { ...bl, items: bl.items.filter((x, j) => (k === st.block && j < st.item) || x.kind !== 'speak') },
    );
    let b = st.block;
    let i = st.item;
    while (b < blocks.length && i >= blocks[b].items.length) {
      b++;
      i = 0;
    }
    persist({ ...st, plan: { ...st.plan, blocks }, block: b, item: i, done: b >= blocks.length });
  }, [st, persist]);

  const api: LessonApi = useMemo(
    () => ({
      setCheck: (fn) => (checkRef.current = fn),
      setReplay: (fn) => (replayRef.current = fn),
      answer: () => {},
      locked: !!result,
      quiet: false,
    }),
    [result],
  );

  // Keyboard: Enter checks or continues, space replays.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (result) advance();
        else checkRef.current?.();
      } else if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        replayRef.current?.();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (finished) return <SessionEnd st={st} onAgain={() => go(`session/${st.plan.mode}/${Date.now().toString(36)}`)} />;

  const total = st.plan.blocks.reduce((n, b) => n + b.items.length, 0);
  const doneCount = st.plan.blocks.slice(0, st.block).reduce((n, b) => n + b.items.length, 0) + st.item;
  return (
    <LessonCtx.Provider value={api}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-72 pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-2xl">
        <header className="flex items-center gap-3">
          <button onClick={() => go('')} aria-label="Leave the session (it's saved)" className="rounded-full p-2 text-muted hover:bg-sunk">
            ✕
          </button>
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total} aria-label="Session progress">
            {st.plan.blocks.map((b, k) => {
              const frac = k < st.block ? 1 : k > st.block ? 0 : st.item / Math.max(1, b.items.length);
              return (
                <div key={k} className="h-3 overflow-hidden rounded-full bg-sunk" style={{ flex: Math.max(3, b.items.length) }} title={BLOCK_TITLE[b.id]}>
                  <div className="h-full rounded-full bg-jade transition-[width] duration-300" style={{ width: `${frac * 100}%` }} />
                </div>
              );
            })}
          </div>
          <span className="min-w-16 text-right text-sm font-semibold tabular-nums text-gold" aria-label={`${st.xp} XP this session`}>
            {st.xp} XP
          </span>
        </header>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-medium text-muted">
            {BLOCK_TITLE[block.id]}
            {st.plan.blocks.length > 1 && <span className="text-xs"> · part {st.block + 1} of {st.plan.blocks.length}</span>}
          </span>
          {st.combo >= 2 && (
            <span key={st.combo} className="anim-pop rounded-full bg-amber-soft px-2.5 py-0.5 font-semibold tabular-nums text-gold" aria-label={`Combo ${st.combo}`}>
              {st.combo} in a row · ×{comboMultiplier(st.combo).toFixed(1)}
            </span>
          )}
        </div>
        {gained !== null && (
          <span key={`${st.block}-${st.item}-${gained}`} className="anim-pop pointer-events-none fixed right-6 top-16 z-30 rounded-full bg-gold px-3 py-1 text-sm font-bold text-ink shadow" aria-hidden>
            +{gained} XP
          </span>
        )}
        <div key={`${st.block}-${st.item}`} className="anim-slide mt-6 flex-1">
          {item!.retry && <p className="mb-3 text-sm font-medium text-cinnabar">One more time</p>}
          <SessionItem item={item!} data={data} onResult={onResult} onNoMic={noMic} />
          {browserVoice && <p className="mt-3 text-center text-xs text-muted">No recording yet, so this was your browser's voice.</p>}
        </div>
      </div>
      {result && (
        <Feedback
          result={result}
          item={item!}
          data={data}
          onContinue={advance}
          onOverride={graded ? override : undefined}
          grade={graded ? <GradeChip rating={graded.rating} onChange={(r) => void regradeAll([graded.card], r).then(() => setGraded({ ...graded, rating: r }))} /> : null}
        />
      )}
    </LessonCtx.Provider>
  );
}

function Feedback({
  result,
  item,
  data,
  onContinue,
  onOverride,
  grade,
}: {
  result: ItemResult;
  item: SItem;
  data: VocabData;
  onContinue: () => void;
  onOverride?: () => void;
  grade: React.ReactNode;
}) {
  const o = result.outcome;
  const { showHanzi } = useSettings();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  const tone = o.verdict === 'wrong' ? 'bg-cinnabar-soft' : o.verdict === 'almost' || o.verdict === 'typo' ? 'bg-amber-soft' : 'bg-jade-soft';
  const title = o.verdict === 'wrong' ? 'Not quite' : o.verdict === 'almost' ? 'Almost' : o.verdict === 'typo' ? 'Right, with a typo' : 'Right';
  const audioId = 'word' in item ? item.word : 'sentence' in item ? item.sentence : null;
  const a = o.answer ?? (audioId ? answerFor(item, data) : undefined);
  return (
    <div role="status" aria-live="polite" className={`anim-rise fixed inset-x-0 bottom-0 z-20 rounded-t-3xl ${tone} px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgb(0_0_0/0.08)]`}>
      <div className="mx-auto max-w-xl lg:max-w-2xl">
        <p className="text-xl font-bold">{title}</p>
        {o.note && <p className="mt-1 text-sm">{o.note}</p>}
        {o.syllables && o.verdict !== 'correct' && <SyllableBreakdown syllables={o.syllables} extra={o.extra} />}
        {a && (
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {a.pinyin && <TonePinyin pinyin={a.pinyin} className="block text-2xl font-semibold" />}
              {showHanzi && a.hanzi && (
                <span className="han block text-lg opacity-70" lang="zh-CN">
                  {a.hanzi}
                </span>
              )}
              {a.english && <p className="opacity-80">{a.english}</p>}
              {audioId && <ReportAudio id={audioId} hanzi={a.hanzi ?? ''} pinyin={a.pinyin} className="mt-1 block" />}
            </div>
            {audioId && (
              <button onClick={() => void play(audioId)} aria-label="Play again" className="rounded-full bg-surface/70 p-3 active:scale-90">
                <Speaker className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        {grade}
        <button ref={btn} onClick={onContinue} className="press mt-4 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Continue
        </button>
        {o.verdict === 'wrong' && o.canOverride && onOverride && (
          <button onClick={onOverride} className="mt-2 h-11 w-full rounded-2xl text-sm font-medium opacity-80 hover:opacity-100">
            I was right: my answer means the same
          </button>
        )}
      </div>
    </div>
  );
}

function answerFor(item: SItem, data: VocabData): Outcome['answer'] {
  if ('word' in item) {
    const w = data.byId.get(item.word);
    return w && { pinyin: w.pinyin, hanzi: w.hanzi, english: shortGloss(w.gloss) };
  }
  if ('sentence' in item) {
    const s = data.sentences.get(item.sentence);
    return s && { pinyin: s.pinyin, hanzi: s.hanzi, english: s.english[0] };
  }
  return undefined;
}
