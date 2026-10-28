import { useState } from 'react';
import { exchanges, lookup, sentences, soundById, words } from '../../content';
import { SentenceText, ToneText } from '../../components/Hanzi';
import { alignToHanzi, markSyllable, type Tone } from '../../lib/pinyin';
import { useSettings } from '../../lib/settings';
import { useCheck, useLesson, useNumberKeys } from '../lesson/context';
import type { Exercise, Outcome } from '../lesson/types';
import { AudioControls, MiniPlay, Options, PinyinInput, Prompt, optionClass, type OptionState } from './parts';
import { altPinyin, checkTyped } from './check';

type Of<K extends Exercise['kind']> = Extract<Exercise, { kind: K }>;

function itemInfo(id: string) {
  const w = words.get(id);
  if (w) return { hanzi: w.hanzi, pinyin: w.pinyin, english: w.english.join('; '), words: [w.id], alt: undefined as { pinyin?: string[] } | undefined };
  const s = sentences.get(id)!;
  return { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english, words: s.words, alt: s.alt };
}

function choiceStates(selected: number | null, answer: number, locked: boolean) {
  return (i: number): OptionState => {
    if (!locked) return selected === i ? 'selected' : 'idle';
    if (i === answer) return 'right';
    if (i === selected) return 'wrong';
    return 'idle';
  };
}

export function ListenMeaning({ ex }: { ex: Of<'listen-meaning'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const info = itemInfo(ex.itemId);
  useCheck(
    sel === null
      ? null
      : (): Outcome => ({ verdict: sel === ex.answer ? 'correct' : 'wrong', answer: { hanzi: info.hanzi, pinyin: info.pinyin, english: ex.options[ex.answer] } }),
    [sel],
  );
  return (
    <div>
      <Prompt>What does this mean?</Prompt>
      <div className="mb-8">
        <AudioControls id={ex.itemId} voice={ex.voice} />
      </div>
      <Options count={ex.options.length} selected={sel} onSelect={setSel} render={(i) => ex.options[i]} stateOf={choiceStates(sel, ex.answer, locked)} />
    </div>
  );
}

export function ListenSentence({ ex }: { ex: Of<'listen-sentence'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const { pinyinDisplay } = useSettings();
  const info = itemInfo(ex.itemId);
  useCheck(
    sel === null ? null : (): Outcome => ({ verdict: sel === ex.answer ? 'correct' : 'wrong', answer: { hanzi: info.hanzi, pinyin: info.pinyin, english: info.english } }),
    [sel],
  );
  return (
    <div>
      <Prompt>Which one did you hear?</Prompt>
      <div className="mb-8">
        <AudioControls id={ex.itemId} voice={ex.voice} />
      </div>
      <Options
        count={ex.options.length}
        selected={sel}
        onSelect={setSel}
        stateOf={choiceStates(sel, ex.answer, locked)}
        render={(i) => {
          const o = lookup(ex.options[i])!;
          return (
            <span className="flex flex-col">
              <ToneText hanzi={o.hanzi} pinyin={o.pinyin} className="han text-2xl" />
              {pinyinDisplay !== 'never' && <span className={`text-sm text-muted ${pinyinDisplay === 'hover' ? 'invisible group-hover:visible' : ''}`}>{o.pinyin}</span>}
            </span>
          );
        }}
      />
    </div>
  );
}

export function Dictation({ ex }: { ex: Of<'dictation'> }) {
  const [text, setText] = useState('');
  const info = itemInfo(ex.itemId);
  useCheck(text.trim() ? () => checkTyped(text, info, altPinyin(info)) : null, [text]);
  return (
    <div>
      <Prompt>Type what you hear in pinyin</Prompt>
      <div className="mb-8">
        <AudioControls id={ex.itemId} voice={ex.voice} />
      </div>
      <PinyinInput value={text} onChange={setText} />
    </div>
  );
}

const TONE_LABELS: Array<{ tone: Tone; label: string; hint: string }> = [
  { tone: 1, label: '1', hint: 'high ‾' },
  { tone: 2, label: '2', hint: 'rising ˊ' },
  { tone: 3, label: '3', hint: 'dipping ˇ' },
  { tone: 4, label: '4', hint: 'falling ˋ' },
  { tone: 5, label: '·', hint: 'neutral' },
];

export function ToneId({ ex }: { ex: Of<'tone-id'> }) {
  const w = words.get(ex.itemId)!;
  const syl = alignToHanzi(w.hanzi, w.pinyin)?.syls ?? [];
  const [picked, setPicked] = useState<Array<Tone | null>>(syl.map(() => null));
  const { locked } = useLesson();
  const active = picked.findIndex((p) => p === null);
  useNumberKeys(5, (i) => {
    const slot = active >= 0 ? active : syl.length - 1;
    setPicked((p) => p.map((v, j) => (j === slot ? TONE_LABELS[i].tone : v)));
  }, !locked);
  const complete = picked.every((p) => p !== null);
  const expected = syl.map((s) => s.tone);
  useCheck(
    complete
      ? (): Outcome => {
          const ok = picked.every((p, i) => p === expected[i] || (expected[i] === 3 && expected[i + 1] === 3 && p === 2));
          return {
            verdict: ok ? 'correct' : 'wrong',
            answer: { hanzi: w.hanzi, pinyin: w.pinyin, english: w.english[0] },
            note: ok ? undefined : `Tones: ${expected.map((t) => (t === 5 ? 'neutral' : t)).join(' + ')}`,
            tones: { expected: expected.join('-'), given: picked.join('-') },
          };
        }
      : null,
    [picked.join()],
  );
  return (
    <div>
      <Prompt>{syl.length > 1 ? 'Which tones do you hear?' : 'Which tone do you hear?'}</Prompt>
      <div className="mb-8">
        <AudioControls id={ex.itemId} voice={ex.voice} />
      </div>
      <div className="flex flex-col gap-5">
        {syl.map((s, si) => (
          <div key={si}>
            {syl.length > 1 && (
              <p className="mb-2 text-sm text-muted">
                Syllable {si + 1}: <span className="font-medium text-ink">{s.base.replace(/v/g, 'ü')}</span>
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {TONE_LABELS.map((t) => {
                const chosen = picked[si] === t.tone;
                let st: OptionState = chosen ? 'selected' : 'idle';
                if (locked) st = t.tone === expected[si] ? 'right' : chosen ? 'wrong' : 'idle';
                return (
                  <button
                    key={t.tone}
                    type="button"
                    disabled={locked}
                    onClick={() => setPicked((p) => p.map((v, j) => (j === si ? t.tone : v)))}
                    className={`flex flex-col items-center rounded-xl border py-2 ${optionClass(st)}`}
                    aria-label={`Tone ${t.hint}`}
                  >
                    <span className="text-lg font-semibold">{t.tone === 5 ? '·' : markSyllable({ base: s.base, tone: t.tone })}</span>
                    <span className="text-[11px] text-muted">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MinimalPair({ ex }: { ex: Of<'minimal-pair'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const opts = [soundById.get(ex.a)!, soundById.get(ex.b)!];
  const target = opts[ex.answer];
  useCheck(
    sel === null
      ? null
      : (): Outcome => ({ verdict: sel === ex.answer ? 'correct' : 'wrong', answer: { hanzi: target.hanzi, pinyin: target.pinyin }, note: ex.hint, items: [] }),
    [sel],
  );
  return (
    <div>
      <Prompt>Which sound is it?</Prompt>
      <div className="mb-8">
        <AudioControls id={target.id} voice={ex.voice} />
      </div>
      <Options
        grid
        count={2}
        selected={sel}
        onSelect={setSel}
        stateOf={choiceStates(sel, ex.answer, locked)}
        render={(i) => <span className="text-3xl font-semibold">{opts[i].pinyin}</span>}
        aside={locked ? (i) => <MiniPlay id={opts[i].id} voice={ex.voice} label={`Play ${opts[i].pinyin}`} /> : undefined}
      />
      {locked && <p className="mt-4 text-sm text-muted">Tap the speakers to compare.</p>}
    </div>
  );
}

function ExchangePrompt({ exchangeId, voice }: { exchangeId: string; voice: Of<'what-would-you-say'>['voice'] }) {
  const x = exchanges.get(exchangeId)!;
  const prompt = sentences.get(x.prompt)!;
  const { quiet, locked } = useLesson();
  return (
    <div className="mb-6 rounded-2xl bg-sunk p-4">
      {x.context && <p className="mb-3 text-sm text-muted">{x.context}</p>}
      {quiet ? (
        <SentenceText sentence={prompt} size="text-2xl" />
      ) : (
        <div className="flex items-center gap-4">
          <AudioControls id={prompt.id} voice={voice} size="sm" />
          {locked && <SentenceText sentence={prompt} size="text-xl" />}
        </div>
      )}
    </div>
  );
}

export function WhatWouldYouSay({ ex }: { ex: Of<'what-would-you-say'> }) {
  const [sel, setSel] = useState<number | null>(null);
  const { locked } = useLesson();
  const { pinyinDisplay } = useSettings();
  const x = exchanges.get(ex.exchangeId)!;
  const reply = sentences.get(x.reply)!;
  const prompt = sentences.get(x.prompt)!;
  useCheck(
    sel === null
      ? null
      : (): Outcome => ({
          verdict: sel === ex.answer ? 'correct' : 'wrong',
          answer: { hanzi: reply.hanzi, pinyin: reply.pinyin, english: reply.english },
          note: `They said: ${prompt.hanzi} (“${prompt.english}”)`,
          items: [{ id: reply.id, verdict: sel === ex.answer ? 'correct' : 'wrong' }],
        }),
    [sel],
  );
  return (
    <div>
      <Prompt>What would you say?</Prompt>
      <ExchangePrompt exchangeId={ex.exchangeId} voice={ex.voice} />
      <Options
        count={ex.options.length}
        selected={sel}
        onSelect={setSel}
        stateOf={choiceStates(sel, ex.answer, locked)}
        render={(i) => {
          const s = sentences.get(ex.options[i])!;
          return (
            <span className="flex min-w-0 flex-col">
              <ToneText hanzi={s.hanzi} pinyin={s.pinyin} className="han text-xl" />
              {pinyinDisplay !== 'never' && <span className={`text-sm text-muted ${pinyinDisplay === 'hover' ? 'invisible group-hover:visible' : ''}`}>{s.pinyin}</span>}
              {locked && <span className="text-sm text-muted">{s.english}</span>}
            </span>
          );
        }}
        aside={(i) => <MiniPlay id={ex.options[i]} voice={ex.voice === 'f' ? 'm' : 'f'} label="Hear this reply" />}
      />
    </div>
  );
}

export function ReplyType({ ex }: { ex: Of<'reply-type'> }) {
  const [text, setText] = useState('');
  const x = exchanges.get(ex.exchangeId)!;
  const reply = sentences.get(x.reply)!;
  useCheck(
    text.trim()
      ? () => {
          const o = checkTyped(text, reply, altPinyin(reply));
          return { ...o, items: [{ id: reply.id, verdict: o.verdict }] };
        }
      : null,
    [text],
  );
  return (
    <div>
      <Prompt>Reply in pinyin</Prompt>
      <ExchangePrompt exchangeId={ex.exchangeId} voice={ex.voice} />
      <p className="mb-3 text-muted">
        Say: <span className="font-medium text-ink">“{reply.english}”</span>
      </p>
      <PinyinInput value={text} onChange={setText} />
    </div>
  );
}
