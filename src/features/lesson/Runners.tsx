/** Route-level screens that run a lesson, story, test-out or practice. */
import { useEffect, useState } from 'react';
import { dialogues, getUnit, nodes } from '../../content';
import { db } from '../../db/db';
import { recordLesson, recordTestOut } from '../../lib/progress';
import { go } from '../../lib/router';
import { useQuietUntil } from '../../lib/settings';
import { practiceItems } from '../../lib/srs';
import { StoryPlayer } from '../story/StoryPlayer';
import { buildNodeLesson, buildPackLesson, buildPractice, buildTestOut } from './build';
import { getPack } from '../packs/store';
import { EndScreen } from './EndScreen';
import { LessonPlayer, type LessonResult } from './LessonPlayer';
import type { Exercise } from './types';

function useRun<T>(make: () => Promise<T> | T, deps: unknown[]): [T | null, () => void] {
  const [val, setVal] = useState<T | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setVal(null);
    Promise.resolve(make()).then((v) => live && setVal(v));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return [val, () => setN((x) => x + 1)];
}

const Loading = () => <div className="p-8 text-center text-muted">Loading…</div>;

export function NodeRunner({ nodeId }: { nodeId: string }) {
  const node = nodes.get(nodeId);
  const quiet = useQuietUntil() > Date.now();
  const [result, setResult] = useState<LessonResult | null>(null);
  const [exercises, again] = useRun<Exercise[] | 'story'>(async () => {
    if (!node) return [];
    if (node.kind === 'story') return 'story';
    const p = await db.progress.get(nodeId);
    return buildNodeLesson(nodeId, { firstTime: !p || p.completions === 0, quiet });
  }, [nodeId]);

  if (!node) return <p className="p-8">This skill doesn't exist.</p>;
  if (result)
    return (
      <EndScreen
        result={result}
        onContinue={() => go('')}
        onAgain={() => {
          setResult(null);
          again();
        }}
      />
    );
  if (!exercises) return <Loading />;

  const finish = async (r: LessonResult) => {
    await recordLesson(nodeId, r.accuracy);
    setResult(r);
  };

  if (exercises === 'story') {
    const unit = getUnit(node.unit)!;
    const d = unit.dialogue ? dialogues.get(unit.dialogue.id)! : null;
    if (!d) return <p className="p-8">Story missing.</p>;
    return <StoryPlayer dialogue={d} onExit={() => go('')} onFinish={finish} />;
  }
  return <LessonPlayer key={exercises[0]?.key} title={node.title} exercises={exercises} nodeId={nodeId} onExit={() => go('')} onFinish={finish} />;
}

export function TestOutRunner({ unitId }: { unitId: string }) {
  const unit = getUnit(unitId);
  const quiet = useQuietUntil() > Date.now();
  const [result, setResult] = useState<{ r: LessonResult; passed: boolean } | null>(null);
  const [exercises, again] = useRun(() => (unit ? buildTestOut(unitId, quiet) : []), [unitId]);
  if (!unit) return <p className="p-8">This unit doesn't exist.</p>;
  if (result)
    return (
      <EndScreen
        result={result.r}
        heading={result.passed ? `You tested out of “${unit.title}”` : 'Not quite yet'}
        extra={result.passed ? 'The next unit is open. Its skills stay replayable whenever you like.' : 'To test out, most answers need to be right first time. Try again any time, or work through the skills.'}
        onContinue={() => go('')}
        onAgain={() => {
          setResult(null);
          again();
        }}
      />
    );
  if (!exercises) return <Loading />;
  return (
    <LessonPlayer
      key={exercises[0]?.key}
      title={`Test out: ${unit.title}`}
      exercises={exercises}
      mode="testout"
      onExit={() => go('')}
      onFinish={async (r) => setResult({ r, passed: await recordTestOut(unitId, r.accuracy) })}
    />
  );
}

export function PracticeRunner() {
  const quiet = useQuietUntil() > Date.now();
  const [result, setResult] = useState<LessonResult | null>(null);
  const [exercises, again] = useRun(async () => buildPractice(await practiceItems(Date.now(), 8), quiet), []);
  if (result)
    return (
      <EndScreen
        result={result}
        onContinue={() => go('')}
        onAgain={() => {
          setResult(null);
          again();
        }}
      />
    );
  if (!exercises) return <Loading />;
  if (exercises.length === 0)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="han text-5xl">练习</p>
        <h1 className="mt-4 text-xl font-bold">Nothing to practise yet</h1>
        <p className="mt-2 text-muted">Practice fills up with reviews and mistakes as you do lessons. Start with the first skill on the path.</p>
        <button onClick={() => go('')} className="mt-6 h-12 rounded-2xl bg-jade px-6 font-semibold text-jade-ink">
          Go to the path
        </button>
      </div>
    );
  return <LessonPlayer key={exercises[0]?.key} title="Practice" exercises={exercises} mode="practice" onExit={() => go('')} onFinish={setResult} />;
}

/** Lesson or story from an imported practice pack. */
export function PackRunner({ id, story }: { id: string; story: boolean }) {
  const quiet = useQuietUntil() > Date.now();
  const [result, setResult] = useState<LessonResult | null>(null);
  const [data, again] = useRun(async () => {
    const p = await getPack(id);
    if (!p) return 'missing' as const;
    const prog = await db.progress.get(`pack:${id}`);
    const ex = buildPackLesson(p.pack, quiet).filter((e) => e.kind !== 'intro' || !prog);
    return { p, ex };
  }, [id]);
  if (result)
    return (
      <EndScreen
        result={result}
        onContinue={() => go('')}
        onAgain={() => {
          setResult(null);
          again();
        }}
      />
    );
  if (data === null) return <Loading />;
  if (data === 'missing') return <p className="p-8">This practice pack isn't on this device.</p>;
  const finish = async (r: LessonResult) => {
    await recordLesson(`pack:${id}`, r.accuracy);
    setResult(r);
  };
  if (story && data.p.pack.dialogue) return <StoryPlayer dialogue={data.p.pack.dialogue} onExit={() => go('')} onFinish={finish} />;
  return <LessonPlayer key={data.ex[0]?.key} title={data.p.title} exercises={data.ex} mode="practice" onExit={() => go('')} onFinish={finish} />;
}
