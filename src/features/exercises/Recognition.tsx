import { useEffect, useMemo, useState } from 'react';
import { sentences, words } from '../../content';
import { SentenceText, ToneText, TonePinyin } from '../../components/Hanzi';
import { shuffle } from '../../lib/random';
import { sfx } from '../../lib/sfx';
import type { Verdict } from '../../lib/pinyinAnswer';
import { useCheck, useLesson } from '../lesson/context';
import type { Exercise, Outcome } from '../lesson/types';
import { AudioControls, Options, Prompt, optionClass, type OptionState } from './parts';

type Of<K extends Exercise['kind']> = Extract<Exercise, { kind: K }>;

function states(sel: number | null, answer: number, locked: boolean) {
  return (i: number): OptionState => (!locked ? (sel === i ? 'selected' : 'idle') : i === answer ? 'right' : i === sel ? 'wrong' : 'idle');
}

export function PickCharacter({ ex }: { ex: Of<'pick-character'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const w = words.get(ex.wordId)!;
  useCheck(sel === null ? null : (): Outcome => ({ verdict: sel === ex.answer ? 'correct' : 'wrong', answer: { hanzi: w.hanzi, pinyin: w.pinyin, english: w.english[0] } }), [sel]);
  return (
    <div>
      <Prompt>Pick the characters</Prompt>
      <div className="mb-6 rounded-2xl bg-sunk p-4">
        <TonePinyin pinyin={w.pinyin} className="text-2xl font-semibold" />
        <p className="mt-1 text-muted">{w.english.join('; ')}</p>
      </div>
      <Options
        grid
        count={ex.options.length}
        selected={sel}
        onSelect={setSel}
        stateOf={states(sel, ex.answer, locked)}
        render={(i) => {
          const o = words.get(ex.options[i])!;
          return <span className="han block py-2 text-center text-4xl" lang="zh-CN">{o.hanzi}</span>;
        }}
      />
    </div>
  );
}

export function ReadSentence({ ex }: { ex: Of<'read-sentence'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const s = sentences.get(ex.sentenceId)!;
  useCheck(sel === null ? null : (): Outcome => ({ verdict: sel === ex.answer ? 'correct' : 'wrong', answer: { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english } }), [sel]);
  return (
    <div>
      <Prompt>What does this say?</Prompt>
      <div className="mb-6 rounded-2xl bg-sunk p-4">
        <SentenceText sentence={s} pinyin={locked} size="text-3xl" />
        {!locked && <p className="mt-2 text-xs text-muted">Stuck? Tap a word to look it up.</p>}
      </div>
      <Options count={ex.options.length} selected={sel} onSelect={setSel} render={(i) => ex.options[i]} stateOf={states(sel, ex.answer, locked)} />
      {locked && (
        <div className="mt-4">
          <AudioControls id={s.id} autoPlay={false} size="sm" />
        </div>
      )}
    </div>
  );
}

/** Tap a character, then its partner. Finishes by itself when all pairs match. */
export function MatchPairs({ ex }: { ex: Of<'match-pairs'> }) {
  const { answer, locked } = useLesson();
  const left = useMemo(() => shuffle(ex.wordIds), [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const right = useMemo(() => shuffle(ex.wordIds), [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pickL, setPickL] = useState<string | null>(null);
  const [pickR, setPickR] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!pickL || !pickR) return;
    if (pickL === pickR) {
      sfx.tap();
      setMatched((m) => [...m, pickL]);
      setPickL(null);
      setPickR(null);
    } else {
      setMissed((m) => [...new Set([...m, pickL, pickR])]);
      setFlash(`${pickL}|${pickR}`);
      const t = setTimeout(() => {
        setFlash(null);
        setPickL(null);
        setPickR(null);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [pickL, pickR]);

  useEffect(() => {
    if (matched.length === ex.wordIds.length && !locked) {
      const items = ex.wordIds.map((id) => ({ id, verdict: (missed.includes(id) ? 'wrong' : 'correct') as Verdict }));
      answer({ verdict: missed.length === 0 ? 'correct' : 'almost', items, note: missed.length ? 'All matched, with a few second tries.' : undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.length]);

  const cell = (id: string, side: 'L' | 'R') => {
    const w = words.get(id)!;
    const done = matched.includes(id);
    const picked = side === 'L' ? pickL === id : pickR === id;
    const wrong = flash && (side === 'L' ? flash.split('|')[0] === id : flash.split('|')[1] === id);
    const st: OptionState = wrong ? 'wrong' : picked ? 'selected' : 'idle';
    return (
      <button
        key={id + side}
        type="button"
        disabled={done || locked}
        onClick={() => (side === 'L' ? setPickL(id) : setPickR(id))}
        className={`flex min-h-16 items-center justify-center rounded-2xl border px-2 py-2 text-center transition ${done ? 'border-transparent bg-sunk opacity-40' : optionClass(st)}`}
      >
        {side === 'L' ? (
          <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han text-3xl" />
        ) : ex.mode === 'pinyin' ? (
          <span className="text-lg">{w.pinyin}</span>
        ) : (
          <span className="text-base leading-tight">{w.english[0]}</span>
        )}
      </button>
    );
  };

  return (
    <div>
      <Prompt>Match the pairs</Prompt>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">{left.map((id) => cell(id, 'L'))}</div>
        <div className="flex flex-col gap-3">{right.map((id) => cell(id, 'R'))}</div>
      </div>
    </div>
  );
}

export function Intro({ ex }: { ex: Of<'intro'> }) {
  const w = words.get(ex.wordId)!;
  const example = (w.examples ?? []).map((id) => sentences.get(id)).find(Boolean);
  useCheck(() => ({ verdict: 'correct', items: [] }), [ex.key]);
  return (
    <div className="text-center">
      <p className="mb-6 text-sm font-medium text-jade">New word</p>
      <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="han block text-7xl font-medium" />
      <TonePinyin pinyin={w.pinyin} className="mt-4 block text-2xl" />
      <p className="mt-2 text-xl">{w.english.join('; ')}</p>
      <div className="mt-8">
        <AudioControls id={w.id} />
      </div>
      {w.note && <p className="mx-auto mt-8 max-w-sm rounded-2xl bg-sunk p-4 text-left text-sm text-muted">{w.note}</p>}
      {example && (
        <div className="mt-6">
          <SentenceText sentence={example} size="text-2xl" />
          <p className="text-muted">{example.english}</p>
        </div>
      )}
    </div>
  );
}
