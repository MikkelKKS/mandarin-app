/** Stories: short reads built from the words you've learned. Reading only; tap a word to look it up. */
import { useEffect, useMemo, useState } from 'react';
import { nodeOrder, units, words, wordByHanzi } from '../../content';
import { StorySchema, segmentWithVocab, type Story, type StoryToken } from '../../content/stories';
import { WordPopover } from '../../components/WordPopover';
import { Lock } from '../../components/icons';
import { db } from '../../db/db';
import { computeStates, nextNode, unitComplete, type NodeState } from '../../lib/progress';
import { go } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { usePinyinFn } from '../../lib/pinyinPro';
import { useLive } from '../../lib/useLive';
import { loadDict, type Dict, type Entry } from '../dictionary/dict';

const modules = import.meta.glob('../../../content/stories/*.json', { eager: true, import: 'default' });
const unitIndex = new Map(units.map((u, i) => [u.id, i]));
export const stories: Story[] = Object.values(modules)
  .map((m) => StorySchema.parse(m))
  .sort((a, b) => (unitIndex.get(a.after) ?? 0) - (unitIndex.get(b.after) ?? 0));

/** Every word the course teaches, for splitting stories into words. */
const allVocab = new Set([...words.values()].map((w) => w.hanzi));

function useStates(): Map<string, NodeState> | null {
  const rows = useLive(() => db.progress.toArray(), [], null);
  return useMemo(() => (rows ? computeStates(nodeOrder, new Map(rows.map((r) => [r.id, r]))) : null), [rows]);
}

/** A story opens once you've finished (or moved past) the unit it follows. */
function isOpen(s: Story, states: Map<string, NodeState>): boolean {
  if (unitComplete(s.after, states)) return true;
  const unit = units.find((u) => u.id === s.after);
  const last = unit?.nodes[unit.nodes.length - 1]?.id;
  const next = nextNode(states);
  return !!last && !!next && nodeOrder.indexOf(next) > nodeOrder.indexOf(last);
}

export function ReadRoute({ route }: { route: string[] }) {
  return route[1] ? <StoryReader id={route[1]} /> : <StoryList />;
}

function StoryList() {
  const states = useStates();
  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold">Read</h1>
      <p className="mt-1 text-muted">Short reads using the words you've learned. Tap any word to look it up.</p>
      <ul className="stagger mt-6 flex flex-col gap-3">
        {stories.map((s) => {
          const open = states ? isOpen(s, states) : false;
          const unit = units.find((u) => u.id === s.after);
          return (
            <li key={s.id}>
              <button
                disabled={!open}
                onClick={() => go(`read/${s.id}`)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${open ? 'border-line bg-surface hover:border-jade' : 'border-dashed border-line text-muted'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="han block text-xl font-semibold" lang="zh-CN">
                    {s.titleHanzi}
                  </span>
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-sm text-muted">{open ? s.blurb : `Opens after “${unit?.title ?? s.after}”`}</span>
                </span>
                {!open && <Lock className="h-5 w-5 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Keep punctuation on the same line as the word before it. */
function groupPunctuation(tokens: StoryToken[]): StoryToken[][] {
  const groups: StoryToken[][] = [];
  for (const t of tokens) {
    if (!t.word && groups.length) groups[groups.length - 1].push(t);
    else groups.push([t]);
  }
  return groups;
}

interface Picked {
  text: string;
  entry?: Entry;
  gloss?: { pinyin: string; english: string };
  audioId?: string;
  anchor: DOMRect;
}

function StoryReader({ id }: { id: string }) {
  const story = stories.find((s) => s.id === id);
  const settings = useSettings();
  const py = usePinyinFn();
  const [dict, setDict] = useState<Dict | null>(null);
  const [english, setEnglish] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  useEffect(() => {
    void loadDict().then(setDict);
  }, []);
  if (!story) return <p className="p-8">This story doesn't exist.</p>;

  const vocab = new Set([...allVocab, ...story.extra.map((e) => e.hanzi)]);
  const extra = new Map(story.extra.map((e) => [e.hanzi, e]));
  const mode = settings.pinyinDisplay;

  const pick = (text: string, anchor: DOMRect) => {
    const w = wordByHanzi(text);
    const x = extra.get(text);
    const fromDict = dict?.byHanzi.get(text)?.[0];
    const entry: Entry | undefined = w
      ? { hanzi: w.hanzi, pinyin: w.pinyin, key: '', defs: w.english, hsk: w.hsk, tones: '' }
      : fromDict;
    setPicked({ text, entry: x ? undefined : entry, gloss: x ? { pinyin: x.pinyin, english: x.english } : undefined, audioId: w?.id, anchor });
  };

  return (
    <div className="pb-10">
      <button onClick={() => go('read')} className="mb-3 text-sm font-medium text-jade">
        ← Read
      </button>
      <h1 className="han text-3xl font-bold" lang="zh-CN">
        {story.titleHanzi}
      </h1>
      <p className="text-muted">{story.title}</p>

      <article className="mt-6 flex flex-col gap-5">
        {story.paragraphs.map((p, pi) => {
          const { tokens } = segmentWithVocab(p.zh, vocab);
          const readings = py ? py(p.zh) : null;
          let offset = 0;
          return (
            <div key={pi}>
              <p className="han flex flex-wrap items-end gap-x-0.5 gap-y-1 text-2xl leading-snug" lang="zh-CN">
                {groupPunctuation(tokens).map((g, gi) => (
                  <span key={gi} className="inline-flex items-end">
                    {g.map((t, ti) => {
                  if (!t.word)
                    return (
                      <span key={ti} className="self-end">
                        {t.text}
                      </span>
                    );
                  const len = [...t.text].length;
                  const reading = readings ? readings.slice(offset, offset + len).join('') : (wordByHanzi(t.text)?.pinyin.replace(/ /g, '') ?? '');
                  offset += len;
                  return (
                    <button
                      key={ti}
                      onClick={(ev) => pick(t.text, ev.currentTarget.getBoundingClientRect())}
                      className={`group inline-flex flex-col items-center rounded px-0.5 leading-none hover:bg-sunk ${extra.has(t.text) ? 'border-b-2 border-dotted border-gold' : ''}`}
                    >
                      {(mode === 'always' || mode === 'hover') && (
                        <span className={`mb-1 font-sans text-[0.42em] leading-none text-muted ${mode === 'hover' ? 'invisible group-hover:visible' : ''}`}>{reading || ' '}</span>
                      )}
                      <span>{t.text}</span>
                    </button>
                  );
                    })}
                  </span>
                ))}
              </p>
              {english && <p className="anim-fade mt-2 text-muted">{p.en}</p>}
            </div>
          );
        })}
      </article>

      {story.extra.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          <span className="border-b-2 border-dotted border-gold">Dotted</span> words aren't in the course yet.
        </p>
      )}
      <button onClick={() => setEnglish(!english)} className="mt-6 h-12 w-full rounded-2xl border-2 border-line font-medium">
        {english ? 'Hide the translation' : 'Show the translation'}
      </button>

      {picked && (
        <WordPopover text={picked.text} entry={picked.entry} gloss={picked.gloss} audioId={picked.audioId} anchor={picked.anchor} onClose={() => setPicked(null)} />
      )}
    </div>
  );
}
