/** Find your level: a short listening + pinyin test, or pick a starting HSK level. */
import { PageHeader } from '../../components/PageHeader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { go } from '../../lib/router';
import { isPass } from '../../lib/pinyinAnswer';
import { rememberText } from '../../lib/audio';
import { updateSettings, useSettings } from '../../lib/settings';
import { sfx } from '../../lib/sfx';
import { meaningOf, useVocab, type VocabRow } from '../../lib/vocabData';
import { checkTyped } from '../exercises/check';
import { AudioControls, PinyinInput } from '../exercises/parts';
import { LessonCtx, type LessonApi } from '../lesson/context';
import { knownBelow, knownFromResults, LEVELS, markKnown, PER_LEVEL, sampleLevel, shouldContinue, type LevelResult } from './placement';

type Phase = { kind: 'start' } | { kind: 'test' } | { kind: 'result'; known: string[] } | { kind: 'done'; count: number };

export function PlacementView() {
  const vocab = useVocab();
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>({ kind: 'start' });
  const [level, setLevel] = useState(2);
  const [results, setResults] = useState<LevelResult[]>([]);
  const [right, setRight] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (!vocab) return <p className="p-8 text-center text-muted">Loading…</p>;

  const apply = async (known: string[]) => {
    setBusy(true);
    const count = await markKnown(known);
    await updateSettings({ placedAt: Date.now() });
    setBusy(false);
    setPhase({ kind: 'done', count });
  };

  if (phase.kind === 'test')
    return (
      <PlacementTest
        vocab={vocab}
        onStop={() => setPhase({ kind: 'start' })}
        onDone={(rs, ok) => {
          setResults(rs);
          setRight(ok);
          setPhase({ kind: 'result', known: knownFromResults(vocab, rs, ok) });
        }}
      />
    );

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageHeader back={{ label: 'Home', to: '' }} title="Find your level" />
      {phase.kind === 'start' && (
        <>
          <p className="mt-1 text-muted">
            So you aren't drilled on words you know. Known words are marked as mature: they come back in 3 to 9 weeks, just to check.
            {settings.placedAt ? ' You did this before; doing it again only adds words.' : ''}
          </p>
          <section className="mt-6 rounded-2xl bg-surface p-5 border border-line">
            <h2 className="text-lg font-semibold">Take the test</h2>
            <p className="mt-1 text-sm text-muted">
              About 5 minutes. You hear words, starting at HSK 1, and type them in pinyin with tones. Up to {PER_LEVEL} words per level; it stops when a level gets hard.
            </p>
            <button onClick={() => setPhase({ kind: 'test' })} className="press mt-4 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
              Start the test
            </button>
          </section>
          <section className="mt-4 rounded-2xl bg-surface p-5 border border-line">
            <h2 className="text-lg font-semibold">Or pick a starting level</h2>
            <p className="mt-1 text-sm text-muted">Every word below the level you pick counts as known.</p>
            <div className="mt-3 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Start at HSK level">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => setLevel(l)}
                  className={`h-11 rounded-xl border font-semibold ${level === l ? 'border-jade bg-jade text-jade-ink' : 'border-line bg-surface'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              disabled={busy || level === 1}
              onClick={() => void apply(knownBelow(vocab, level))}
              className="mt-4 h-12 w-full rounded-2xl border border-line font-medium disabled:opacity-50"
            >
              {level === 1 ? 'HSK 1: start from the beginning' : `Start at HSK ${level} (${knownBelow(vocab, level).length.toLocaleString('en-GB')} words known)`}
            </button>
          </section>
        </>
      )}
      {phase.kind === 'result' && (
        <>
          <ul className="mt-5 flex flex-col gap-3">
            {results.map((r) => (
              <li key={r.level}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">HSK {r.level}</span>
                  <span className="tabular-nums text-muted">
                    {r.right} of {r.asked} right
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-sunk">
                  <div className="h-full rounded-full bg-jade" style={{ width: `${(r.right / Math.max(1, r.asked)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            That puts about <span className="font-semibold">{phase.known.length.toLocaleString('en-GB')} words</span> in the "known" pile
            {right.size ? `, including the ${right.size} you got right` : ''}.
          </p>
          <button disabled={busy} onClick={() => void apply(phase.known)} className="press mt-5 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            {busy ? 'Saving…' : `Mark ${phase.known.length.toLocaleString('en-GB')} words as known`}
          </button>
          <button onClick={() => setPhase({ kind: 'start' })} className="mt-3 h-12 w-full rounded-2xl border border-line font-medium">
            Not now
          </button>
        </>
      )}
      {phase.kind === 'done' && (
        <>
          <p className="mt-4 text-lg">
            Done: <span className="font-semibold">{phase.count.toLocaleString('en-GB')}</span> words marked as known. New words now start after them.
          </p>
          <button onClick={() => go('')} className="press mt-6 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            Home
          </button>
        </>
      )}
    </div>
  );
}

function PlacementTest({ vocab, onDone, onStop }: { vocab: VocabRow[]; onDone: (r: LevelResult[], right: Set<string>) => void; onStop: () => void }) {
  const [li, setLi] = useState(0);
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState<{ ok: boolean; w: VocabRow } | null>(null);
  const results = useRef<LevelResult[]>([]);
  const right = useRef(new Set<string>());
  const samples = useMemo(() => LEVELS.map((l) => sampleLevel(vocab, l)), [vocab]);
  const level = LEVELS[li];
  const items = samples[li];
  const w = items[i];
  useEffect(() => {
    if (w) rememberText(w.id, w.hanzi);
  }, [w]);

  const finishLevel = () => {
    const r: LevelResult = { level, asked: items.length, right: items.filter((x) => right.current.has(x.id)).length };
    results.current.push(r);
    if (!shouldContinue(r) || li + 1 >= LEVELS.length) onDone(results.current, right.current);
    else {
      setLi(li + 1);
      setI(0);
    }
  };
  const next = () => {
    setAnswer(null);
    setText('');
    if (i + 1 >= items.length) finishLevel();
    else setI(i + 1);
  };
  const check = (giveUp = false) => {
    if (answer || !w) return;
    const ok = !giveUp && isPass(checkTyped(text, { pinyin: w.pinyin, hanzi: w.hanzi }).verdict);
    if (ok) {
      right.current.add(w.id);
      sfx.correct();
    } else sfx.wrong();
    setAnswer({ ok, w });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (answer) next();
      else if (text.trim()) check();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const api: LessonApi = { setCheck: () => {}, setReplay: () => {}, answer: () => {}, locked: !!answer, quiet: false };
  if (!w) {
    // A level without testable words: skip it.
    setTimeout(finishLevel, 0);
    return null;
  }
  return (
    <LessonCtx.Provider value={api}>
      <div className="mx-auto max-w-xl pb-10">
        <div className="flex items-center justify-between text-sm">
          <button onClick={onStop} className="font-medium text-jade">
            ✕ Stop
          </button>
          <span className="tabular-nums text-muted">
            HSK {level} · {i + 1} of {items.length}
          </span>
        </div>
        <h1 className="mt-6 text-lg font-semibold">Type what you hear, with tones</h1>
        <div key={w.id} className="mt-6">
          <AudioControls id={w.id} />
        </div>
        {!answer ? (
          <div className="mt-8">
            <PinyinInput value={text} onChange={setText} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => check(true)} className="h-14 rounded-2xl border border-line font-medium">
                I don't know
              </button>
              <button onClick={() => check()} disabled={!text.trim()} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted">
                Check
              </button>
            </div>
          </div>
        ) : (
          <div className={`anim-rise mt-8 rounded-2xl p-4 ${answer.ok ? 'bg-jade-soft' : 'bg-sunk'}`}>
            <p className="font-semibold">{answer.ok ? 'Right' : 'Not this time'}</p>
            <TonePinyin pinyin={answer.w.pinyin} className="text-2xl font-semibold" />
            <p className="text-sm text-muted">{meaningOf(answer.w)}</p>
            <button onClick={next} className="press mt-4 h-12 w-full rounded-2xl bg-jade font-semibold text-jade-ink">
              Next
            </button>
          </div>
        )}
      </div>
    </LessonCtx.Provider>
  );
}
