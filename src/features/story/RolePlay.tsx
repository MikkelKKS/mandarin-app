/**
 * Role-play: the learner takes one part of a dialogue. The other lines play
 * as audio; for their own lines they see the English and type the Chinese
 * in pinyin. Wrong lines are retyped until right.
 */
import { useEffect, useRef, useState } from 'react';
import { sentences } from '../../content';
import type { Dialogue } from '../../content/schema';
import { SentenceText } from '../../components/Hanzi';
import { Close, Speaker } from '../../components/icons';
import { play, stop } from '../../lib/audio';
import { isPass } from '../../lib/pinyinAnswer';
import { sfx } from '../../lib/sfx';
import { recordAnswer } from '../../lib/srs';
import { altPinyin, checkTyped } from '../exercises/check';
import { PinyinInput } from '../exercises/parts';
import { LessonCtx } from '../lesson/context';
import type { LessonResult } from '../lesson/LessonPlayer';
import type { Outcome } from '../lesson/types';

/** The part the learner plays by default: 米格 if present, else whoever speaks last. */
export function defaultRole(d: Dialogue): string {
  const me = d.speakers.find((s) => s.name.includes('米格') || s.name === 'Me');
  return me?.id ?? d.lines[d.lines.length - 1].speaker;
}

export function RolePlayPlayer({
  dialogue,
  nodeId,
  onExit,
  onFinish,
}: {
  dialogue: Dialogue;
  nodeId?: string;
  onExit: () => void;
  onFinish: (r: LessonResult) => void;
}) {
  const [role, setRole] = useState<string | null>(null);
  const speakers = new Map(dialogue.speakers.map((s) => [s.id, s]));

  if (!role) {
    const suggested = defaultRole(dialogue);
    const ordered = [...dialogue.speakers].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0));
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <button onClick={onExit} aria-label="Leave role-play" className="rounded-full p-2 text-muted hover:bg-sunk">
            <Close className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Role-play: {dialogue.title}</h1>
        </header>
        <p className="mt-4 text-muted">{dialogue.setting}</p>
        <p className="mt-3">You say one person's lines in pinyin. The other person speaks.</p>
        <div className="mt-8 flex flex-col gap-3">
          {ordered.map((s, i) => (
            <button
              key={s.id}
              autoFocus={i === 0}
              onClick={() => setRole(s.id)}
              className={`h-14 rounded-2xl text-lg font-semibold ${i === 0 ? 'bg-jade text-jade-ink' : 'border-2 border-line bg-surface'}`}
            >
              Play as <span className="han">{s.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return <Run dialogue={dialogue} role={role} nodeId={nodeId} speakers={speakers} onExit={onExit} onFinish={onFinish} />;
}

function Run({
  dialogue,
  role,
  nodeId,
  speakers,
  onExit,
  onFinish,
}: {
  dialogue: Dialogue;
  role: string;
  nodeId?: string;
  speakers: Map<string, Dialogue['speakers'][number]>;
  onExit: () => void;
  onFinish: (r: LessonResult) => void;
}) {
  // `at` = index of the line currently in focus; lines before it are done.
  const [at, setAt] = useState(0);
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const firstTry = useRef(new Map<number, boolean>());
  const started = useRef(Date.now());
  const bottom = useRef<HTMLDivElement>(null);
  const lines = dialogue.lines;
  const mine = (i: number) => lines[i]?.speaker === role;
  const total = lines.filter((l) => l.speaker === role).length;

  useEffect(() => () => stop(), []);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [at, outcome]);

  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    const right = [...firstTry.current.values()].filter(Boolean).length;
    const mistakes = [...firstTry.current.entries()].filter(([, ok]) => !ok).map(([i]) => lines[i].sentence);
    onFinish({ accuracy: total ? right / total : 1, ms: Date.now() - started.current, newWords: [], mistakes, total });
  };

  // The other person's lines play one after another until it's the learner's turn.
  useEffect(() => {
    if (at >= lines.length) {
      finish();
      return;
    }
    if (mine(at)) return;
    let live = true;
    const line = lines[at];
    play(line.sentence, { voice: speakers.get(line.speaker)!.voice }).then(() => {
      if (live) setTimeout(() => live && setAt((a) => (a === at ? a + 1 : a)), 300);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const check = () => {
    if (!mine(at) || outcome || !text.trim()) return;
    const s = sentences.get(lines[at].sentence)!;
    const o = checkTyped(text, { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english }, altPinyin(s));
    const pass = isPass(o.verdict);
    if (!firstTry.current.has(at)) {
      firstTry.current.set(at, pass);
      void recordAnswer(s.id, o.verdict, { exercise: 'roleplay', nodeId, tones: o.tones });
    }
    if (pass) sfx.correct();
    else sfx.wrong();
    setOutcome(o);
    void play(s.id, { voice: speakers.get(role)!.voice });
  };

  const next = () => {
    if (!outcome) return;
    if (isPass(outcome.verdict)) {
      setOutcome(null);
      setText('');
      setAt(at + 1);
    } else {
      setOutcome(null);
      setText('');
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (outcome) next();
      else check();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const yourTurn = at < lines.length && mine(at);
  const current = yourTurn ? sentences.get(lines[at].sentence)! : null;
  const pass = outcome ? isPass(outcome.verdict) : false;

  return (
    <LessonCtx.Provider value={{ setCheck: () => {}, setReplay: () => {}, answer: () => {}, locked: !!outcome, quiet: false }}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-72 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <button onClick={onExit} aria-label="Leave role-play" className="rounded-full p-2 text-muted hover:bg-sunk">
            <Close className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">{dialogue.title}</h1>
          <span className="ml-auto text-sm text-muted">
            You are <span className="han">{speakers.get(role)!.name}</span>
          </span>
        </header>

        <ol className="mt-5 flex flex-col gap-3">
          {lines.slice(0, Math.min(at + 1, lines.length)).map((line, i) => {
            if (i === at && yourTurn) return null;
            const s = sentences.get(line.sentence)!;
            const sp = speakers.get(line.speaker)!;
            const me = line.speaker === role;
            const open = me || shown.has(i);
            return (
              <li key={i} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 ${me ? 'rounded-br-sm bg-jade-soft' : 'rounded-bl-sm bg-surface'} ${i === at ? 'ring-2 ring-jade' : ''}`}>
                  <p className="mb-1 text-xs text-muted han">{sp.name}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => play(s.id, { voice: sp.voice })} aria-label="Play line" className="rounded-full bg-surface/80 p-2 text-jade">
                      <Speaker className="h-5 w-5" />
                    </button>
                    {open ? (
                      <SentenceText sentence={s} size="text-xl" />
                    ) : (
                      <button
                        onClick={() => setShown((x) => new Set(x).add(i))}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-sunk"
                      >
                        Show text
                      </button>
                    )}
                  </div>
                  {open && !me && <p className="mt-1 text-sm text-muted">{s.english}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        <div ref={bottom} />
      </div>

      {yourTurn && current && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <p className="text-sm text-muted">Your turn. Say:</p>
            <p className="mb-3 text-lg font-medium">{current.english}</p>
            {outcome ? (
              <div className={`mb-3 rounded-2xl p-3 ${pass ? 'bg-jade-soft' : 'bg-sunk'}`}>
                <p className="font-semibold">{pass ? (outcome.verdict === 'correct' ? 'Correct' : outcome.verdict === 'typo' ? 'Correct, but mind the typo' : 'Almost') : 'Not quite'}</p>
                {outcome.note && <p className="text-sm text-muted">{outcome.note}</p>}
                <div className="mt-1">
                  <SentenceText sentence={current} size="text-2xl" />
                </div>
              </div>
            ) : (
              <PinyinInput value={text} onChange={setText} />
            )}
            <button
              onClick={outcome ? next : check}
              disabled={!outcome && !text.trim()}
              className="mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted"
            >
              {outcome ? (pass ? 'Continue' : 'Try again') : 'Check'}
            </button>
          </div>
        </footer>
      )}
    </LessonCtx.Provider>
  );
}
