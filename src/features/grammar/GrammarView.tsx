/**
 * Library → Grammar: how Chinese sentences are built. Each topic is a short
 * read (the pattern, a few paragraphs, examples, common mistakes) with a
 * practice round. Finishing a practice round gives the topic a review card
 * (FSRS); when it's due, a question from it comes up in your sessions.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Speaker } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { TonePinyin } from '../../components/Hanzi';
import { db } from '../../db/db';
import { TOPICS, topicById } from '../../lib/grammarData';
import { exampleAudioId, grammarCardId, practiceRating, shuffled, type Topic } from '../../lib/grammarTopics';
import { recordReview, type RatingName } from '../../lib/review';
import { go } from '../../lib/router';
import { currentSettings } from '../../lib/settings';
import { useLive } from '../../lib/useLive';
import type { ItemResult } from '../session/items';
import { GLine, GPlay, ScriptSwitch } from './parts';
import { GrammarQuestion } from './Question';

const LEVEL_TITLE: Record<number, string> = { 1: 'First steps (HSK 1)', 2: 'Everyday sentences (HSK 2)', 3: 'Building longer sentences (HSK 3)' };

type CardInfo = { due: number; state: number; reps: number };
function useTopicCards(): Map<string, CardInfo> | null {
  return useLive(
    async () => {
      const rows = await db.reviewItems.where('id').startsWith('gram-').toArray();
      return new Map(rows.map((r) => [r.id.slice(5), { due: r.due, state: r.state, reps: r.reps }]));
    },
    [],
    null,
  );
}

function statusOf(c: CardInfo | undefined, now = Date.now()): { text: string; due: boolean } {
  if (!c || c.reps === 0) return { text: 'Not practised yet', due: false };
  if (c.due <= now) return { text: 'Due for practice', due: true };
  const days = Math.max(1, Math.round((c.due - now) / 864e5));
  return { text: `Practised · next in ${days} day${days === 1 ? '' : 's'}`, due: false };
}

export function GrammarRoute({ route }: { route: string[] }) {
  const topic = route[1] ? topicById.get(route[1]) : undefined;
  if (topic && route[2] === 'practice') return <Practice topic={topic} />;
  if (topic) return <TopicPage topic={topic} />;
  return <GrammarList />;
}

function GrammarList() {
  const cards = useTopicCards();
  const levels = [...new Set(TOPICS.map((t) => t.level))];
  const practised = cards ? TOPICS.filter((t) => (cards.get(t.id)?.reps ?? 0) > 0).length : 0;
  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Library', to: 'library' }} title="Grammar">
        How Chinese sentences are built, in short reads with practice. {cards ? `${practised} of ${TOPICS.length} practised.` : ''} Once you've practised a topic, questions from it come back in your sessions.
      </PageHeader>
      {levels.map((l) => (
        <section key={l} className="mt-6">
          <h2 className="text-sm font-medium text-muted">{LEVEL_TITLE[l] ?? `HSK ${l}`}</h2>
          <ul className="group-list mt-2">
            {TOPICS.filter((t) => t.level === l).map((t) => {
              const st = statusOf(cards?.get(t.id));
              return (
                <li key={t.id}>
                  <button onClick={() => go(`grammar/${t.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunk/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.title}</span>
                      <span className="block text-sm leading-snug text-muted">{t.summary}</span>
                      {cards && <span className={`mt-0.5 block text-xs ${st.due ? 'font-semibold text-gold' : 'text-muted'}`}>{st.text}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TopicPage({ topic }: { topic: Topic }) {
  const cards = useTopicCards();
  const st = statusOf(cards?.get(topic.id));
  const i = TOPICS.indexOf(topic);
  const next = TOPICS[i + 1];
  return (
    <div className="pb-10">
      <PageHeader back={{ label: 'Grammar', to: 'grammar' }} title={topic.title}>
        {topic.summary}
      </PageHeader>
      <p className="mt-4 rounded-2xl border border-gold/40 bg-amber-soft/60 px-4 py-3 font-medium">{topic.pattern}</p>
      <div className="mt-5 flex flex-col gap-3 text-lg leading-relaxed">
        {topic.text.map((p, k) => (
          <p key={k}>{p}</p>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Examples</h2>
        <ScriptSwitch />
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {topic.examples.map((e, k) => (
          <li key={k} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <GPlay id={exampleAudioId(topic.id, k)} label="Play the example" />
            <div className="min-w-0">
              <GLine line={e.t} />
              <p className="text-sm text-muted">{e.en}</p>
              {e.note && <p className="mt-1 text-sm">{e.note}</p>}
            </div>
          </li>
        ))}
      </ul>

      {topic.mistakes && topic.mistakes.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Common mistakes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {topic.mistakes.map((m, k) => (
              <li key={k} className="rounded-2xl border border-line bg-surface p-3">
                <p className="flex gap-2">
                  <span className="font-semibold text-cinnabar" aria-label="Wrong">
                    ✗
                  </span>
                  <GLine line={m.wrong} size="sm" className="line-through decoration-cinnabar/50" />
                </p>
                <p className="mt-1 flex gap-2">
                  <span className="font-semibold text-jade" aria-label="Right">
                    ✓
                  </span>
                  <GLine line={m.right} size="sm" />
                </p>
                <p className="mt-1 text-sm text-muted">{m.why}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="mt-8 rounded-2xl bg-sunk p-4">
        <p className="font-semibold">Practice</p>
        <p className="mt-0.5 text-sm text-muted">
          {topic.exercises.length} questions: put words in order, choose the missing word, spot the right sentence. {cards ? st.text + '.' : ''}
        </p>
        <button onClick={() => go(`grammar/${topic.id}/practice`)} className="press mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          Practise this
        </button>
      </section>
      {next && (
        <button onClick={() => go(`grammar/${next.id}`)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left">
          <span>
            <span className="block text-xs text-muted">Next topic</span>
            <span className="block font-semibold">{next.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
      )}
    </div>
  );
}

/** All of a topic's questions in a random order; at the end the topic's review card is graded. */
function Practice({ topic }: { topic: Topic }) {
  const order = useMemo(() => shuffled(topic.exercises.map((_, k) => k)), [topic]);
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<ItemResult | null>(null);
  const [right, setRight] = useState(0);
  const [graded, setGraded] = useState<RatingName | null>(null);
  const done = pos >= order.length;

  const finish = async (score: number) => {
    const rating = practiceRating(score, order.length);
    await recordReview(grammarCardId(topic.id), rating, { exercise: 'grammar-practice', verdict: rating === 'good' ? 'correct' : rating === 'hard' ? 'almost' : 'wrong', itemId: grammarCardId(topic.id) }, currentSettings().retention);
    setGraded(rating);
  };
  const next = () => {
    const score = right;
    setResult(null);
    if (pos + 1 >= order.length) void finish(score);
    setPos(pos + 1);
  };

  if (done)
    return (
      <div className="pb-10">
        <PageHeader back={{ label: topic.title, to: `grammar/${topic.id}` }} title="Practice done" />
        <p className="mt-6 text-center text-6xl font-semibold tabular-nums">
          {right}
          <span className="text-3xl text-muted">/{order.length}</span>
        </p>
        <p className="mt-3 text-center text-muted">
          {graded === null
            ? 'Saving…'
            : graded === 'good'
              ? 'All right. It comes back in your sessions in a few days.'
              : graded === 'hard'
                ? 'Nearly all right. It comes back in your sessions soon.'
                : 'Worth another look: it comes back in your sessions tomorrow. Reading the topic again helps.'}
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <button onClick={() => go('grammar')} className="press h-14 rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            Back to Grammar
          </button>
          <button onClick={() => go(`grammar/${topic.id}`)} className="h-12 rounded-2xl border border-line font-medium">
            Read the topic again
          </button>
        </div>
      </div>
    );

  return (
    <div className="pb-56">
      <PageHeader back={{ label: topic.title, to: `grammar/${topic.id}` }} title="Practice" />
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label="Practice progress" aria-valuenow={pos} aria-valuemax={order.length}>
        <div className="h-full rounded-full bg-jade transition-[width] duration-300" style={{ width: `${(pos / order.length) * 100}%` }} />
      </div>
      <GrammarQuestion
        key={pos}
        topic={topic}
        index={order[pos]}
        onResult={(r) => {
          setResult(r);
          if (r.outcome.verdict === 'correct') setRight((n) => n + 1);
        }}
      />
      {result && <PracticeFeedback result={result} onNext={next} last={pos + 1 >= order.length} />}
    </div>
  );
}

function PracticeFeedback({ result, onNext, last }: { result: ItemResult; onNext: () => void; last: boolean }) {
  const o = result.outcome;
  const ok = o.verdict === 'correct';
  return (
    <div role="status" aria-live="polite" className={`anim-rise fixed inset-x-0 bottom-0 z-20 rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgb(0_0_0/0.08)] ${ok ? 'bg-jade-soft' : 'bg-cinnabar-soft'}`}>
      <div className="mx-auto max-w-xl">
        <p className="text-xl font-semibold">{ok ? 'Right' : 'Not quite'}</p>
        {o.note && <p className="mt-1 text-sm">{o.note}</p>}
        {o.answer?.pinyin && (
          <div className="mt-2 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <TonePinyin pinyin={o.answer.pinyin} className="block text-lg font-semibold" />
              {o.answer.hanzi && (
                <span className="han block opacity-70" lang="zh-CN">
                  {o.answer.hanzi}
                </span>
              )}
            </div>
            {result.audio && (
              <button onClick={result.audio} aria-label="Play again" className="rounded-full bg-surface/70 p-3 active:scale-90">
                <Speaker className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        {result.panel}
        <button autoFocus onClick={onNext} className="press mt-4 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
          {last ? 'See the result' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
