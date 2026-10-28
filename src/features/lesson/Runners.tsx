/** Route-level screen that runs a Conversations lesson or story. */
import { useEffect, useState } from 'react';
import { dialogues, getUnit, nodes } from '../../content';
import { db } from '../../db/db';
import { courseWordState, isStartedState, loadWordStates } from '../../lib/knowledge';
import { recordLesson } from '../../lib/progress';
import { go } from '../../lib/router';
import { StoryPlayer } from '../story/StoryPlayer';
import { RolePlayPlayer } from '../story/RolePlay';
import { buildNodeLesson } from './build';
import { useQuietUntil } from '../../lib/settings';
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

export function NodeRunner({ nodeId, roleplay = false }: { nodeId: string; roleplay?: boolean }) {
  const node = nodes.get(nodeId);
  const quiet = useQuietUntil() > Date.now();
  const [result, setResult] = useState<LessonResult | null>(null);
  const [exercises, again] = useRun<Exercise[] | 'story'>(async () => {
    if (!node) return [];
    if (node.kind === 'story') return 'story';
    const [p, known] = await Promise.all([db.progress.get(nodeId), loadWordStates()]);
    // Words you've already met anywhere in the app aren't introduced again.
    const fresh = node.words.filter((w) => !isStartedState(courseWordState(w, known)));
    return buildNodeLesson(nodeId, { introduce: !p || p.completions === 0 ? fresh : [], quiet });
  }, [nodeId]);

  if (!node) return <p className="p-8">This skill doesn't exist.</p>;
  if (result)
    return (
      <EndScreen
        result={result}
        onContinue={() => go('conversations')}
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
    if (roleplay) return <RolePlayPlayer dialogue={d} nodeId={nodeId} onExit={() => go('conversations')} onFinish={finish} />;
    return <StoryPlayer dialogue={d} onExit={() => go('conversations')} onFinish={finish} />;
  }
  return <LessonPlayer key={exercises[0]?.key} title={node.title} exercises={exercises} nodeId={nodeId} onExit={() => go('conversations')} onFinish={finish} />;
}
