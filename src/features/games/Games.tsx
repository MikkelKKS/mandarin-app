import { useEffect, useMemo, useState } from 'react';
import { sounds, words } from '../../content';
import type { Sentence, Word } from '../../content/schema';
import { ToneText } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { play } from '../../lib/audio';
import { hanziOnly, parsePinyin, type Tone } from '../../lib/pinyin';
import { shuffle, sample, pick } from '../../lib/random';
import { sfx } from '../../lib/sfx';
import { useNumberKeys } from '../lesson/context';
import { optionClass, type OptionState } from '../exercises/parts';
import { GameFrame, pickWeighted, useStudyRecorder, type GameDef, type Pool } from './shared';

export const GAMES: GameDef[] = [
  { id: 'tone-sort', title: 'Tone Sort', hanzi: '声调', blurb: 'Hear a syllable, sort it into the right tone. Train your ear for the four tones.', seconds: 60, unit: 'tones sorted' },
  { id: 'tone-pairs', title: 'Tone Pairs', hanzi: '双调', blurb: 'Hear a two-syllable word and pick its tone pattern. Where most tone mistakes happen.', seconds: 60, unit: 'tone pairs heard' },
  { id: 'listening-blitz', title: 'Listening Blitz', hanzi: '快听', blurb: 'Hear a word and pick its meaning, as many as you can before time runs out.', seconds: 60, unit: 'words understood' },
  { id: 'pair-rush', title: 'Pair Rush', hanzi: '配对', blurb: 'Clear boards of characters and meanings. A fresh board appears each time you finish one.', seconds: 60, unit: 'pairs matched' },
  { id: 'sentence-scramble', title: 'Sentence Scramble', hanzi: '组句', blurb: 'Build the Chinese sentence from tiles, in order, against the clock.', seconds: 90, unit: 'sentences built' },
  { id: 'measure-match', title: 'Measure Word Match', hanzi: '量词', blurb: 'Two dogs, a cup of tea: pick the right measure word (个, 只, 杯…).', seconds: 60, unit: 'correct picks' },
];

export const gameDef = (id: string): GameDef => GAMES.find((g) => g.id === id)!;

const syllableCount = (w: Word) => [...hanziOnly(w.hanzi)].length;

// ---------------- Tone Sort ----------------

interface ToneItem {
  id: string;
  hanzi: string;
  pinyin: string;
  tone: Tone;
}

function toneItems(pool: Pool): ToneItem[] {
  const fromSounds = sounds.syllables.map((s) => ({ id: s.id, hanzi: s.hanzi, pinyin: s.pinyin, tone: parsePinyin(s.pinyin)![0].tone }));
  const fromWords = pool.words
    .filter((w) => syllableCount(w) === 1)
    .map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, tone: parsePinyin(w.pinyin, 1)?.[0]?.tone ?? 5 }))
    .filter((w) => w.tone !== 5);
  return [...fromSounds, ...fromWords] as ToneItem[];
}

const TONE_BUCKETS: Array<{ tone: Tone; name: string; path: string }> = [
  { tone: 1, name: 'high', path: 'M4 6 H28' },
  { tone: 2, name: 'rising', path: 'M4 22 L28 6' },
  { tone: 3, name: 'dip', path: 'M4 12 Q14 30 28 8' },
  { tone: 4, name: 'falling', path: 'M4 6 L28 26' },
];

export function ToneSort({ pool }: { pool: Pool }) {
  const items = useMemo(() => toneItems(pool), [pool]);
  const def = gameDef('tone-sort');
  return (
    <GameFrame def={def} minItems={4} available={items.length}>
      {({ addScore, miss }) => <ToneSortPlay items={items} pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function ToneSortPlay({ items, pool, addScore, miss }: { items: ToneItem[]; pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('tone-sort');
  const next = () => pickWeighted(items, pool.weights, 1)[0];
  const [cur, setCur] = useState<ToneItem>(next);
  const [flash, setFlash] = useState<{ picked: Tone; ok: boolean } | null>(null);
  useEffect(() => void play(cur.id), [cur]);
  const answer = (t: Tone) => {
    if (flash) return;
    const ok = t === cur.tone;
    record(cur.id, ok ? 'correct' : 'wrong');
    if (ok) {
      sfx.correct();
      addScore();
    } else miss();
    setFlash({ picked: t, ok });
    setTimeout(() => {
      setFlash(null);
      setCur(next());
    }, ok ? 350 : 1100);
  };
  useNumberKeys(4, (i) => answer((i + 1) as Tone));
  return (
    <div className="flex flex-col items-center pt-6">
      <button onClick={() => play(cur.id)} aria-label="Play again" className="flex h-28 w-28 items-center justify-center rounded-full bg-jade text-jade-ink shadow-md active:scale-95">
        <Speaker className="h-12 w-12" />
      </button>
      <p className={`mt-4 h-10 text-2xl ${flash ? '' : 'invisible'}`}>
        <ToneText hanzi={cur.hanzi} pinyin={cur.pinyin} className="han" /> <span className="text-muted">{cur.pinyin}</span>
      </p>
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        {TONE_BUCKETS.map((b, i) => {
          let st: OptionState = 'idle';
          if (flash && b.tone === cur.tone) st = 'right';
          else if (flash && b.tone === flash.picked) st = 'wrong';
          return (
            <button key={b.tone} onClick={() => answer(b.tone)} className={`flex h-24 flex-col items-center justify-center rounded-2xl border-2 ${optionClass(st)}`}>
              <svg viewBox="0 0 32 32" className={`h-10 w-10 text-t${b.tone}`} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                <path d={b.path} />
              </svg>
              <span className="text-sm font-medium">
                <span className="mr-1 hidden text-muted sm:inline">{i + 1}</span>Tone {b.tone} · {b.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Listening Blitz ----------------

const toneless = (p: string) => (parsePinyin(p) ?? []).map((s) => s.base).join('');

function blitzRound(pool: Pool) {
  const target = pickWeighted(pool.words, pool.weights, 1)[0];
  const others = pool.words.filter((w) => w.id !== target.id && w.english[0] !== target.english[0] && toneless(w.pinyin) !== toneless(target.pinyin));
  const opts = shuffle([target, ...sample(others, 3)]);
  return { target, opts };
}

export function ListeningBlitz({ pool }: { pool: Pool }) {
  return (
    <GameFrame def={gameDef('listening-blitz')} minItems={6} available={pool.words.length}>
      {({ addScore, miss }) => <BlitzPlay pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function BlitzPlay({ pool, addScore, miss }: { pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('listening-blitz');
  const [r, setR] = useState(() => blitzRound(pool));
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => void play(r.target.id), [r]);
  const answer = (i: number) => {
    if (picked !== null) return;
    const ok = r.opts[i].id === r.target.id;
    record(r.target.id, ok ? 'correct' : 'wrong');
    if (ok) {
      sfx.correct();
      addScore();
    } else miss();
    setPicked(i);
    setTimeout(() => {
      setPicked(null);
      setR(blitzRound(pool));
    }, ok ? 300 : 1100);
  };
  useNumberKeys(4, answer);
  return (
    <div className="flex flex-col items-center pt-6">
      <button onClick={() => play(r.target.id)} aria-label="Play again" className="flex h-28 w-28 items-center justify-center rounded-full bg-jade text-jade-ink shadow-md active:scale-95">
        <Speaker className="h-12 w-12" />
      </button>
      <div className="mt-8 flex w-full flex-col gap-3">
        {r.opts.map((o, i) => {
          let st: OptionState = 'idle';
          if (picked !== null && o.id === r.target.id) st = 'right';
          else if (picked === i) st = 'wrong';
          return (
            <button key={o.id} onClick={() => answer(i)} className={`min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg ${optionClass(st)}`}>
              <span className="mr-2 hidden text-sm text-muted sm:inline">{i + 1}</span>
              {o.english[0]}
              {picked !== null && o.id === r.target.id && <span className="han ml-2 text-muted">{o.hanzi}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Pair Rush ----------------

function board(pool: Pool): Word[] {
  const chosen: Word[] = [];
  for (const w of pickWeighted(pool.words, pool.weights, 20)) {
    if (chosen.some((c) => c.hanzi === w.hanzi || c.english[0] === w.english[0])) continue;
    chosen.push(w);
    if (chosen.length === 5) break;
  }
  return chosen;
}

export function PairRush({ pool }: { pool: Pool }) {
  return (
    <GameFrame def={gameDef('pair-rush')} minItems={5} available={pool.words.length}>
      {({ addScore, miss }) => <PairPlay pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function PairPlay({ pool, addScore, miss }: { pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('pair-rush');
  const [ws, setWs] = useState(() => board(pool));
  const left = useMemo(() => shuffle(ws), [ws]);
  const right = useMemo(() => shuffle(ws), [ws]);
  const [l, setL] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const missed = useMemo(() => new Set<string>(), [ws]);

  const tryMatch = (rid: string) => {
    if (!l) return;
    if (l === rid) {
      sfx.tap();
      addScore();
      record(rid, missed.has(rid) ? 'wrong' : 'correct');
      const nd = [...done, rid];
      setDone(nd);
      setL(null);
      if (nd.length === ws.length) {
        setTimeout(() => {
          setDone([]);
          setWs(board(pool));
        }, 250);
      }
    } else {
      missed.add(l);
      miss();
      setBad(rid);
      setTimeout(() => setBad(null), 350);
      setL(null);
    }
  };

  const cell = (w: Word, side: 'L' | 'R') => {
    const isDone = done.includes(w.id);
    const st: OptionState = side === 'R' && bad === w.id ? 'wrong' : side === 'L' && l === w.id ? 'selected' : 'idle';
    return (
      <button
        key={w.id + side}
        disabled={isDone}
        onClick={() => (side === 'L' ? setL(w.id) : tryMatch(w.id))}
        className={`flex min-h-16 items-center justify-center rounded-2xl border-2 px-2 text-center ${isDone ? 'border-transparent bg-sunk opacity-30' : optionClass(st)}`}
      >
        {side === 'L' ? <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-3xl" /> : <span className="leading-tight">{w.english[0]}</span>}
      </button>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-3 pt-4">
      <div className="flex flex-col gap-3">{left.map((w) => cell(w, 'L'))}</div>
      <div className="flex flex-col gap-3">{right.map((w) => cell(w, 'R'))}</div>
    </div>
  );
}

// ---------------- Sentence Scramble ----------------

const scrambleable = (s: Sentence) => s.words.length >= 3 && s.words.length <= 7;

export function SentenceScramble({ pool }: { pool: Pool }) {
  const list = pool.sentences.filter(scrambleable);
  return (
    <GameFrame def={gameDef('sentence-scramble')} minItems={3} available={list.length}>
      {({ addScore, miss }) => <ScramblePlay list={list} pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function ScramblePlay({ list, pool, addScore, miss }: { list: Sentence[]; pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('sentence-scramble');
  const [s, setS] = useState(() => pickWeighted(list, pool.weights, 1)[0]);
  const tiles = useMemo(() => shuffle(s.words.map((id, i) => ({ key: i, w: words.get(id)! }))), [s]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const [slip, setSlip] = useState(false);
  const target = s.words.map((id) => words.get(id)!.hanzi);

  const tap = (key: number) => {
    const t = tiles.find((x) => x.key === key)!;
    if (t.w.hanzi === target[placed.length]) {
      const np = [...placed, key];
      setPlaced(np);
      sfx.tap();
      if (np.length === target.length) {
        record(s.id, slip ? 'almost' : 'correct');
        addScore();
        sfx.correct();
        void play(s.id);
        setTimeout(() => {
          setPlaced([]);
          setSlip(false);
          setS(pickWeighted(list, pool.weights, 1, new Set([s.id]))[0] ?? pick(list));
        }, 900);
      }
    } else {
      setSlip(true);
      miss();
      setShake(key);
      setTimeout(() => setShake(null), 300);
    }
  };

  return (
    <div className="pt-4">
      <p className="rounded-2xl bg-sunk p-4 text-xl">{s.english}</p>
      <div className="han my-6 flex min-h-14 flex-wrap gap-2 border-b-2 border-line pb-3 text-2xl" lang="zh-CN">
        {placed.map((k) => {
          const w = tiles.find((x) => x.key === k)!.w;
          return <ToneText key={k} hanzi={w.hanzi} pinyin={w.pinyin} className="rounded-xl bg-jade-soft px-3 py-1.5" />;
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((t) =>
          placed.includes(t.key) ? null : (
            <button
              key={t.key}
              onClick={() => tap(t.key)}
              className={`flex flex-col items-center rounded-xl border-2 border-b-4 px-3 py-1.5 ${shake === t.key ? 'anim-shake border-cinnabar' : 'border-line bg-surface'}`}
            >
              <span className="text-xs text-muted">{t.w.pinyin}</span>
              <ToneText hanzi={t.w.hanzi} pinyin={t.w.pinyin} className="han text-2xl" />
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// ---------------- Measure Word Match ----------------

const NUMBERS = [
  { hz: '一', en: 'one', n: 1 },
  { hz: '两', en: 'two', n: 2 },
  { hz: '三', en: 'three', n: 3 },
  { hz: '四', en: 'four', n: 4 },
  { hz: '五', en: 'five', n: 5 },
];
const NOT_CLASSIFIERS = new Set(['w-sui', 'w-dian']);

export function MeasureMatch({ pool }: { pool: Pool }) {
  const nouns = pool.words.filter((w) => w.measure && words.has(w.measure));
  const classifiers = [...words.values()].filter((w) => w.pos === 'measure' && !NOT_CLASSIFIERS.has(w.id));
  return (
    <GameFrame def={gameDef('measure-match')} minItems={3} available={new Set(nouns.map((n) => n.measure)).size >= 2 ? nouns.length : 0}>
      {({ addScore, miss }) => <MeasurePlay nouns={nouns} classifiers={classifiers} pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function MeasurePlay({ nouns, classifiers, pool, addScore, miss }: { nouns: Word[]; classifiers: Word[]; pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('measure-match');
  const round = () => {
    const noun = pickWeighted(nouns, pool.weights, 1)[0];
    const right = words.get(noun.measure!)!;
    const opts = shuffle([right, ...sample(classifiers.filter((c) => c.id !== right.id), 3)]);
    return { noun, right, opts, num: pick(NUMBERS) };
  };
  const [r, setR] = useState(round);
  const [picked, setPicked] = useState<number | null>(null);
  const answer = (i: number) => {
    if (picked !== null) return;
    const ok = r.opts[i].id === r.right.id;
    record(r.noun.id, ok ? 'correct' : 'wrong');
    if (ok) {
      sfx.correct();
      addScore();
    } else miss();
    setPicked(i);
    setTimeout(() => {
      setPicked(null);
      setR(round());
    }, ok ? 400 : 1200);
  };
  useNumberKeys(r.opts.length, answer);
  return (
    <div className="pt-6 text-center">
      <p className="text-muted">
        {r.num.en} × {r.noun.english[0]}
      </p>
      <p className="han mt-4 text-5xl" lang="zh-CN">
        {r.num.hz}
        <span className={`mx-2 inline-block min-w-16 border-b-4 ${picked !== null ? 'border-transparent text-jade' : 'border-jade text-transparent'}`}>{r.right.hanzi}</span>
        <ToneText hanzi={r.noun.hanzi} pinyin={r.noun.pinyin} />
      </p>
      <div className="mt-10 grid grid-cols-2 gap-3">
        {r.opts.map((o, i) => {
          let st: OptionState = 'idle';
          if (picked !== null && o.id === r.right.id) st = 'right';
          else if (picked === i) st = 'wrong';
          return (
            <button key={o.id} onClick={() => answer(i)} className={`flex flex-col items-center rounded-2xl border-2 py-3 ${optionClass(st)}`}>
              <span className="han text-4xl">{o.hanzi}</span>
              <span className="text-sm text-muted">{o.pinyin}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Tone Pairs ----------------

interface PairItem {
  id: string;
  hanzi: string;
  pinyin: string;
  tones: Tone[];
}

/** Plausible wrong patterns: flip one syllable to a commonly confused tone. */
const CONFUSE: Record<number, Tone[]> = { 1: [4, 2], 2: [3, 1], 3: [2, 4], 4: [1, 3], 5: [3, 1] };
function distractors(t: Tone[]): Tone[][] {
  const out = new Map<string, Tone[]>();
  for (let i = 0; i < t.length; i++) for (const c of CONFUSE[t[i]]) {
    const v = [...t];
    v[i] = c;
    out.set(v.join(), v);
  }
  out.delete(t.join());
  return shuffle([...out.values()]).slice(0, 3);
}

export function TonePairs({ pool }: { pool: Pool }) {
  const items = useMemo<PairItem[]>(
    () =>
      pool.words
        .map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, tones: parsePinyin(w.pinyin, syllableCount(w))?.map((s) => s.tone) ?? [] }))
        .filter((w) => w.tones.length === 2),
    [pool],
  );
  return (
    <GameFrame def={gameDef('tone-pairs')} minItems={4} available={items.length}>
      {({ addScore, miss }) => <TonePairsPlay items={items} pool={pool} addScore={addScore} miss={miss} />}
    </GameFrame>
  );
}

function ToneGlyph({ t }: { t: Tone }) {
  const d = t === 5 ? 'M10 16 h12' : TONE_BUCKETS[t - 1].path;
  return (
    <svg viewBox="0 0 32 32" className={`h-8 w-8 text-t${t}`} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function TonePairsPlay({ items, pool, addScore, miss }: { items: PairItem[]; pool: Pool; addScore: () => void; miss: () => void }) {
  const record = useStudyRecorder('tone-pairs');
  const round = () => {
    const it = pickWeighted(items, pool.weights, 1)[0];
    return { it, opts: shuffle([it.tones, ...distractors(it.tones)]) };
  };
  const [r, setR] = useState(round);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => void play(r.it.id), [r]);
  const answer = (i: number) => {
    if (picked !== null) return;
    const ok = r.opts[i].join() === r.it.tones.join();
    record(r.it.id, ok ? 'correct' : 'wrong');
    if (ok) {
      sfx.correct();
      addScore();
    } else miss();
    setPicked(i);
    setTimeout(() => {
      setPicked(null);
      setR(round());
    }, ok ? 500 : 1600);
  };
  useNumberKeys(r.opts.length, answer);
  const label = (t: Tone) => (t === 5 ? 'neutral' : String(t));
  return (
    <div className="flex flex-col items-center pt-6">
      <button onClick={() => play(r.it.id)} aria-label="Play again" className="flex h-28 w-28 items-center justify-center rounded-full bg-jade text-jade-ink shadow-md active:scale-95">
        <Speaker className="h-12 w-12" />
      </button>
      <button onClick={() => play(r.it.id, { slow: true })} className="mt-3 text-sm text-muted underline">
        Play slowly
      </button>
      <p className={`mt-3 h-10 text-2xl ${picked !== null ? '' : 'invisible'}`}>
        <ToneText hanzi={r.it.hanzi} pinyin={r.it.pinyin} className="han" /> <span className="text-muted">{r.it.pinyin}</span>
      </p>
      <div className="mt-4 grid w-full grid-cols-2 gap-3">
        {r.opts.map((o, i) => {
          let st: OptionState = 'idle';
          if (picked !== null && o.join() === r.it.tones.join()) st = 'right';
          else if (picked === i) st = 'wrong';
          return (
            <button key={o.join()} onClick={() => answer(i)} className={`flex h-24 flex-col items-center justify-center rounded-2xl border-2 ${optionClass(st)}`} aria-label={`Tones ${o.map(label).join(' and ')}`}>
              <span className="flex items-center gap-1">
                <ToneGlyph t={o[0]} />
                <ToneGlyph t={o[1]} />
              </span>
              <span className="text-sm font-medium">
                <span className="mr-1 hidden text-muted sm:inline">{i + 1}</span>
                {o.map(label).join(' + ')}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted">Remember: 3 + 3 is spoken as 2 + 3, but written as 3 + 3.</p>
    </div>
  );
}
