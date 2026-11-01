/**
 * One grammar exercise: put the words in order, choose the missing word, or
 * spot the right sentence. Used on the Grammar pages and in sessions; reports
 * once through onResult (like every session item).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { exerciseAudioId, hanziOf, orderIsRight, pinyinOf, sentenceOf, shuffled, wordsOf, type Exercise, type Topic } from '../../lib/grammarTopics';
import { useSettings } from '../../lib/settings';
import { Options, Prompt } from '../exercises/parts';
import { useCheck } from '../lesson/context';
import type { Outcome } from '../lesson/types';
import { DontKnow, GAVE_UP_NOTE, type ItemResult } from '../session/items';
import { GLine, hasGrammarAudio, playGrammar } from './parts';

export function GrammarQuestion({ topic, index, onResult }: { topic: Topic; index: number; onResult: (r: ItemResult) => void }) {
  const ex = topic.exercises[index];
  const done = useRef(false);
  const audioId = exerciseAudioId(topic.id, index);
  const report = (verdict: 'correct' | 'wrong', gaveUp = false) => {
    if (done.current) return;
    done.current = true;
    const line = sentenceOf(ex);
    const why = 'why' in ex && ex.why ? ex.why : undefined;
    void playGrammar(audioId);
    onResult({
      outcome: {
        verdict,
        answer: { pinyin: pinyinOf(line), hanzi: hanziOf(line), english: ex.en },
        note: gaveUp ? GAVE_UP_NOTE : undefined,
      },
      gaveUp,
      panel: <Why topic={topic} why={why} />,
      audio: hasGrammarAudio(audioId) ? () => void playGrammar(audioId) : undefined,
      lookup: hanziOf(line),
    });
  };
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gold">Grammar · {topic.title}</p>
      {ex.type === 'order' ? <Order ex={ex} key={index} onAnswer={report} /> : <Choice ex={ex} onAnswer={report} />}
    </div>
  );
}

function Why({ topic, why }: { topic: Topic; why?: string }) {
  return (
    <div className="mt-2 text-sm">
      {why && <p>{why}</p>}
      <p className="mt-1 opacity-80">
        {topic.pattern}{' '}
        <a href={`#/grammar/${topic.id}`} className="underline underline-offset-2">
          Read the topic
        </a>
      </p>
    </div>
  );
}

/** Choose the missing word, or spot the right sentence. */
function Choice({ ex, onAnswer }: { ex: Extract<Exercise, { type: 'choose' | 'spot' }>; onAnswer: (v: 'correct' | 'wrong', gaveUp?: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const { sentenceScript } = useSettings();
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswer(i === ex.answer ? 'correct' : 'wrong', i < 0);
  };
  return (
    <div>
      <Prompt>{ex.type === 'choose' ? 'Fill the gap' : 'Which sentence is right?'}</Prompt>
      <p className="rounded-2xl border border-line bg-surface p-4 text-center text-lg font-medium">{ex.en}</p>
      {ex.type === 'choose' && <GLine line={ex.t} size="lg" className="mt-5 text-center" />}
      <div className="mt-6">
        <Options
          count={ex.options.length}
          selected={picked}
          onSelect={choose}
          stateOf={(i) => (picked === null ? 'idle' : i === ex.answer ? 'right' : i === picked ? 'wrong' : 'idle')}
          render={(i) =>
            ex.type === 'spot' ? (
              <GLine line={ex.options[i]} size="sm" />
            ) : (
              // The words to choose from: pinyin and characters (的, 得 and 地 only differ in writing).
              <span className="flex items-baseline gap-3">
                <TonePinyin pinyin={pinyinOf(ex.options[i], false)} className="text-lg font-semibold" />
                {sentenceScript !== 'pinyin' || new Set(ex.options.map((o) => pinyinOf(o))).size < ex.options.length ? (
                  <span className="han text-lg text-muted" lang="zh-CN">
                    {hanziOf(ex.options[i])}
                  </span>
                ) : null}
              </span>
            )
          }
        />
      </div>
      {picked === null && <DontKnow onGiveUp={() => choose(-1)} />}
    </div>
  );
}

/** Put the words in order: tap tiles to build the sentence; tap a placed tile to take it back. */
function Order({ ex, onAnswer }: { ex: Extract<Exercise, { type: 'order' }>; onAnswer: (v: 'correct' | 'wrong', gaveUp?: boolean) => void }) {
  const { sentenceScript } = useSettings();
  const words = useMemo(() => wordsOf(ex.t), [ex.t]);
  const tiles = useMemo(() => shuffled(words.map((w, i) => ({ ...w, i })), Math.random, (a) => orderIsRight(ex, a)), [words, ex]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const check = () => {
    if (checked !== null || placed.length < tiles.length) return null as unknown as Outcome;
    const right = orderIsRight(ex, placed.map((k) => tiles[k]));
    setChecked(right);
    onAnswer(right ? 'correct' : 'wrong');
    return null as unknown as Outcome;
  };
  useCheck(check, [placed, checked]);
  useEffect(() => setPlaced([]), [ex]);
  const han = sentenceScript !== 'pinyin';
  const Tile = ({ k }: { k: number }) => (
    <span className="flex flex-col items-center leading-tight">
      <TonePinyin pinyin={tiles[k].p} className="text-lg font-semibold" />
      {han && (
        <span className="han text-sm text-muted" lang="zh-CN">
          {tiles[k].h}
        </span>
      )}
    </span>
  );
  return (
    <div>
      <Prompt>Put the words in order</Prompt>
      <p className="rounded-2xl border border-line bg-surface p-4 text-center text-lg font-medium">{ex.en}</p>
      <div
        aria-label="Your sentence"
        className={`mt-5 flex min-h-20 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3 ${checked === null ? 'border-line' : checked ? 'border-jade bg-jade-soft' : 'border-cinnabar bg-cinnabar-soft'}`}
      >
        {placed.length === 0 && <span className="px-1 text-sm text-muted">Tap the words below</span>}
        {placed.map((k, j) => (
          <button key={k} disabled={checked !== null} onClick={() => setPlaced(placed.filter((_, x) => x !== j))} className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
            <Tile k={k} />
          </button>
        ))}
      </div>
      <div aria-label="Word tiles" className="mt-4 flex flex-wrap justify-center gap-2">
        {tiles.map((_, k) => (
          <button
            key={k}
            disabled={placed.includes(k) || checked !== null}
            onClick={() => setPlaced((cur) => (cur.includes(k) ? cur : [...cur, k]))}
            className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm transition active:scale-95 disabled:opacity-25"
          >
            <Tile k={k} />
          </button>
        ))}
      </div>
      {checked === null && (
        <>
          <button onClick={check} disabled={placed.length < tiles.length} className="press mt-6 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted">
            Check
          </button>
          <DontKnow
            onGiveUp={() => {
              setChecked(false);
              onAnswer('wrong', true);
            }}
          />
        </>
      )}
    </div>
  );
}
