/**
 * Listening dialogue: audio first, text revealed on demand, then
 * comprehension questions.
 */
import { useEffect, useRef, useState } from 'react';
import { sentences } from '../../content';
import type { Dialogue } from '../../content/schema';
import { SentenceText } from '../../components/Hanzi';
import { Close, Speaker, Turtle } from '../../components/icons';
import { play, stop } from '../../lib/audio';
import { sfx } from '../../lib/sfx';
import { useNumberKeys } from '../lesson/context';
import type { LessonResult } from '../lesson/LessonPlayer';
import { optionClass, type OptionState } from '../exercises/parts';

type Reveal = 0 | 1 | 2; // 0 hidden, 1 characters + pinyin, 2 + English

export function StoryPlayer({ dialogue, onExit, onFinish }: { dialogue: Dialogue; onExit: () => void; onFinish: (r: LessonResult) => void }) {
  const [phase, setPhase] = useState<'listen' | 'questions'>('listen');
  const [reveal, setReveal] = useState<Reveal[]>(dialogue.lines.map(() => 0));
  const [current, setCurrent] = useState<number | null>(null);
  const [heardAll, setHeardAll] = useState(false);
  const playing = useRef(false);
  const started = useRef(Date.now());
  const speakers = new Map(dialogue.speakers.map((s) => [s.id, s]));

  useEffect(() => () => stop(), []);

  const playLine = async (i: number, slow = false) => {
    setCurrent(i);
    const line = dialogue.lines[i];
    await play(line.sentence, { voice: speakers.get(line.speaker)!.voice, slow });
    setCurrent((c) => (c === i ? null : c));
  };

  const playAll = async (slow = false) => {
    if (playing.current) {
      playing.current = false;
      stop();
      return;
    }
    playing.current = true;
    for (let i = 0; i < dialogue.lines.length && playing.current; i++) {
      await playLine(i, slow);
      await new Promise((r) => setTimeout(r, 350));
    }
    playing.current = false;
    setCurrent(null);
    setHeardAll(true);
  };

  if (phase === 'questions') {
    return <Questions dialogue={dialogue} onExit={onExit} onDone={(acc) => onFinish({ accuracy: acc, ms: Date.now() - started.current, newWords: [], mistakes: [], total: dialogue.questions.length })} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-32 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button onClick={onExit} aria-label="Leave story" className="rounded-full p-2 text-muted hover:bg-sunk">
          <Close className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">{dialogue.title}</h1>
      </header>
      <p className="mt-3 text-muted">{dialogue.setting}</p>
      <p className="mt-2 text-sm text-muted">Listen first. Tap a line's text button to peek: once for characters, twice for English.</p>

      <div className="my-6 flex items-center justify-center gap-4">
        <button onClick={() => playAll(false)} className="flex h-14 items-center gap-2 rounded-full bg-jade px-6 text-lg font-semibold text-jade-ink">
          <Speaker className="h-6 w-6" /> Play conversation
        </button>
        <button onClick={() => playAll(true)} aria-label="Play conversation slowly" className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-line bg-surface text-muted">
          <Turtle className="h-6 w-6" />
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        {dialogue.lines.map((line, i) => {
          const s = sentences.get(line.sentence)!;
          const sp = speakers.get(line.speaker)!;
          const right = sp.voice === 'm';
          return (
            <li key={i} className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 ${right ? 'rounded-br-sm bg-jade-soft' : 'rounded-bl-sm bg-surface'} ${current === i ? 'ring-2 ring-jade' : ''}`}>
                <p className="mb-1 text-xs text-muted">{sp.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => playLine(i)} aria-label={`Play line ${i + 1}`} className="rounded-full bg-surface/80 p-2 text-jade">
                    <Speaker className="h-5 w-5" />
                  </button>
                  {reveal[i] === 0 ? (
                    <span className="flex gap-1" aria-hidden>
                      {Array.from({ length: Math.min(8, s.words.length + 1) }, (_, k) => (
                        <span key={k} className="h-2 w-5 rounded-full bg-line" />
                      ))}
                    </span>
                  ) : (
                    <SentenceText sentence={s} size="text-xl" />
                  )}
                  <button
                    onClick={() => setReveal((r) => r.map((v, j) => (j === i ? (((v + 1) % 3) as Reveal) : v)))}
                    className="ml-auto rounded-lg px-2 py-1 text-xs text-muted hover:bg-sunk"
                    aria-label={reveal[i] === 2 ? 'Hide text' : 'Show text'}
                  >
                    {reveal[i] === 0 ? '文' : reveal[i] === 1 ? 'EN' : 'Hide'}
                  </button>
                </div>
                {reveal[i] === 2 && <p className="mt-1 text-sm text-muted">{s.english}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex justify-center gap-3 text-sm">
        <button className="rounded-lg px-3 py-2 text-muted hover:bg-sunk" onClick={() => setReveal(dialogue.lines.map(() => 2))}>
          Show all text
        </button>
        <button className="rounded-lg px-3 py-2 text-muted hover:bg-sunk" onClick={() => setReveal(dialogue.lines.map(() => 0))}>
          Hide all
        </button>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            onClick={() => {
              stop();
              playing.current = false;
              setPhase('questions');
            }}
            className={`h-14 w-full rounded-2xl text-lg font-semibold ${heardAll ? 'bg-jade text-jade-ink' : 'border-2 border-line bg-surface'}`}
          >
            Answer the questions
          </button>
        </div>
      </footer>
    </div>
  );
}

function Questions({ dialogue, onExit, onDone }: { dialogue: Dialogue; onExit: () => void; onDone: (accuracy: number) => void }) {
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const correct = useRef(0);
  const q = dialogue.questions[qi];
  const check = () => {
    if (sel === null || locked) return;
    setLocked(true);
    if (sel === q.answer) {
      correct.current++;
      sfx.correct();
    } else sfx.wrong();
  };
  const next = () => {
    if (qi + 1 >= dialogue.questions.length) onDone(correct.current / dialogue.questions.length);
    else {
      setQi(qi + 1);
      setSel(null);
      setLocked(false);
    }
  };
  useNumberKeys(q.options.length, (i) => !locked && setSel(i));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (locked) next();
      else check();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const st = (i: number): OptionState => (!locked ? (sel === i ? 'selected' : 'idle') : i === q.answer ? 'right' : i === sel ? 'wrong' : 'idle');
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-32 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button onClick={onExit} aria-label="Leave story" className="rounded-full p-2 text-muted hover:bg-sunk">
          <Close className="h-6 w-6" />
        </button>
        <p className="text-sm text-muted">
          Question {qi + 1} of {dialogue.questions.length}
        </p>
      </header>
      <h2 className="mb-5 mt-6 text-xl font-semibold">{q.q}</h2>
      <div className="flex flex-col gap-3">
        {q.options.map((o, i) => (
          <button key={i} disabled={locked} onClick={() => setSel(i)} className={`min-h-14 rounded-2xl border-2 px-4 py-3 text-left ${optionClass(st(i))}`}>
            {o}
          </button>
        ))}
      </div>
      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            onClick={locked ? next : check}
            disabled={sel === null}
            className="h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted"
          >
            {locked ? (sel === q.answer ? 'Correct! Continue' : 'Continue') : 'Check'}
          </button>
        </div>
      </footer>
    </div>
  );
}
