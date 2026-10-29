/** Stories: short reads built from the words you've learned. Reading only; tap a word to look it up. */
import { VolumeSlider } from '../../components/VolumeSlider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { units, words, wordByHanzi } from '../../content';
import { StorySchema, segmentWithVocab, type Story, type StoryToken } from '../../content/stories';
import { WordPopover } from '../../components/WordPopover';
import { ChevronRight, Speaker } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { ProgressBar } from '../../components/ProgressBar';
import { play, rememberText, stop } from '../../lib/audio';
import { hanziKnowledge, useWordStates } from '../../lib/knowledge';
import { useVocab } from '../../lib/vocabData';
import { go } from '../../lib/router';
import { TonePinyin } from '../../components/Hanzi';
import { usePinyinFn } from '../../lib/pinyinPro';
import { loadDict, type Dict, type Entry } from '../dictionary/dict';
import { db } from '../../db/db';
import { readableShare, readCardId, readingStates } from '../../lib/reading';
import { recordSessionAnswer } from '../../lib/srs';
import { useLive } from '../../lib/useLive';
import { loadReadData, useReadData } from '../reading/data';

const CHARS_ONLY = 'read:chars-only';
function loadCharsOnly(): boolean {
  try {
    return localStorage.getItem(CHARS_ONLY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Characters only": a tapped word counts as a miss on its character → meaning
 * card, if it has reading cards already (once per word per visit). Untapped words aren't graded.
 */
async function tappedWhileReading(hanzi: string): Promise<void> {
  const d = await loadReadData();
  const w = d.vocab.words.find((x) => x.hanzi === hanzi);
  const item = (w && d.index.itemOfWord.get(w.id)) ?? d.index.itemOfChar.get(hanzi);
  if (!item) return;
  const card = readCardId(item, 'rm');
  if (!(await db.reviewItems.get(card))) return;
  await recordSessionAnswer({ card, itemId: item, verdict: 'wrong', rating: 'again', exercise: 'read-story', xp: 0 });
}

const modules = import.meta.glob('../../../content/stories/*.json', { eager: true, import: 'default' });
const unitIndex = new Map(units.map((u, i) => [u.id, i]));
export const stories: Story[] = Object.values(modules)
  .map((m) => StorySchema.parse(m))
  .sort((a, b) => (unitIndex.get(a.after) ?? 0) - (unitIndex.get(b.after) ?? 0));

/** Every word the course teaches, for splitting stories into words. */
const allVocab = new Set([...words.values()].map((w) => w.hanzi));

/** Audio id of a story paragraph (recorded with Azure like everything else). */
export const paragraphId = (story: string, i: number) => `${story}-p${i}`;

/** Pure: share of a story's words you know (in review), counting each word once. */
export function storyKnown(story: Story, known: Set<string>): number {
  const vocab = new Set([...allVocab, ...known]);
  const seen = new Set<string>();
  for (const p of story.paragraphs) for (const t of segmentWithVocab(p.zh, vocab).tokens) if (t.word) seen.add(t.word);
  if (!seen.size) return 0;
  return [...seen].filter((w) => known.has(w)).length / seen.size;
}

export function ReadRoute({ route }: { route: string[] }) {
  return route[1] ? <StoryReader id={route[1]} /> : <StoryList />;
}

function StoryList() {
  const vocab = useVocab();
  const states = useWordStates();
  const known = useMemo(() => (vocab && states ? hanziKnowledge(vocab, states).known : null), [vocab, states]);
  const rd = useReadData();
  const cards = useLive(() => db.reviewItems.toArray(), [], null);
  const reading = useMemo(() => (cards ? readingStates(cards) : null), [cards]);
  return (
    <div className="pb-8">
      <PageHeader back={{ label: 'Library', to: 'library' }} title="Stories">
        Short stories about 米格's life in Copenhagen and Beijing, read aloud. Tap any word to look it up.
      </PageHeader>
      <ul className="group-list mt-6">
        {stories.map((s) => {
          const share = known ? storyKnown(s, known) : null;
          return (
            <li key={s.id}>
              <button onClick={() => go(`read/${s.id}`)} className="flex w-full items-center gap-4 px-4 py-4 text-left first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-sunk/50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-3">
                    <span className="han text-xl font-semibold" lang="zh-CN">
                      {s.titleHanzi}
                    </span>
                    <span className="truncate font-medium">{s.title}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{s.blurb}</span>
                  {share !== null && (
                    <span className="mt-2 flex items-center gap-3">
                      <ProgressBar value={share} label={`${s.title}: words you know`} className="w-24" />
                      <span className="text-xs tabular-nums text-muted">You know {Math.round(share * 100)}% of the words</span>
                    </span>
                  )}
                  {rd && reading && (
                    <span className="mt-1 flex items-center gap-3">
                      <ProgressBar value={readableShare(s.paragraphs.map((p) => p.zh).join(''), rd.index, reading) ?? 0} label={`${s.title}: characters you can read`} className="w-24" />
                      <span className="text-xs tabular-nums text-muted">
                        You can read {Math.round((readableShare(s.paragraphs.map((p) => p.zh).join(''), rd.index, reading) ?? 0) * 100)}% of the characters
                      </span>
                    </span>
                  )}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
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
  const py = usePinyinFn();
  const [dict, setDict] = useState<Dict | null>(null);
  const [english, setEnglish] = useState(false);
  const [charsOnly, setCharsOnly] = useState(loadCharsOnly);
  const missed = useRef(new Set<string>());
  const toggleCharsOnly = () => {
    const v = !charsOnly;
    setCharsOnly(v);
    try {
      localStorage.setItem(CHARS_ONLY, v ? '1' : '0');
    } catch {
      // not remembered
    }
  };
  const [picked, setPicked] = useState<Picked | null>(null);
  /** Paragraph being read aloud (Play all, or one paragraph). */
  const [reading, setReading] = useState<number | null>(null);
  const playing = useRef(0);
  useEffect(() => {
    void loadDict().then(setDict);
    return () => {
      playing.current++;
      stop();
    };
  }, []);
  if (!story) return <p className="p-8">This story doesn't exist.</p>;
  story.paragraphs.forEach((p, i) => rememberText(paragraphId(story.id, i), p.zh));

  const playFrom = async (start: number, all: boolean) => {
    const run = ++playing.current;
    for (let i = start; i < story.paragraphs.length; i++) {
      setReading(i);
      await play(paragraphId(story.id, i));
      if (run !== playing.current || !all) break;
      await new Promise((r) => setTimeout(r, 450));
      if (run !== playing.current) break;
    }
    if (run === playing.current) setReading(null);
  };
  const stopReading = () => {
    playing.current++;
    stop();
    setReading(null);
  };

  const vocab = new Set([...allVocab, ...story.extra.map((e) => e.hanzi)]);
  const extra = new Map(story.extra.map((e) => [e.hanzi, e]));
  // The "Characters only" button is the one switch here: off = pinyin under every word.

  const pick = (text: string, anchor: DOMRect) => {
    const w = wordByHanzi(text);
    const x = extra.get(text);
    const fromDict = dict?.byHanzi.get(text)?.[0];
    const entry: Entry | undefined = w
      ? { hanzi: w.hanzi, pinyin: w.pinyin, key: '', defs: w.english, hsk: w.hsk, tones: '' }
      : fromDict;
    setPicked({ text, entry: x ? undefined : entry, gloss: x ? { pinyin: x.pinyin, english: x.english } : undefined, audioId: w?.id, anchor });
    if (charsOnly && !missed.current.has(text)) {
      missed.current.add(text);
      void tappedWhileReading(text);
    }
  };

  return (
    <div className="pb-10">
      <PageHeader back={{ label: 'Stories', to: 'read' }} title={story.title} />
      <p className="han -mt-1 text-lg text-muted" lang="zh-CN">
        {story.titleHanzi}
      </p>
      <div className="mt-5 flex gap-2">
        <button onClick={() => (reading !== null ? stopReading() : void playFrom(0, true))} className="btn btn-primary h-11 gap-2 px-5 text-base">
          <Speaker className="h-5 w-5" />
          {reading !== null ? 'Stop' : 'Play all'}
        </button>
        <button onClick={() => setEnglish(!english)} aria-pressed={english} className="btn btn-quiet h-11 px-4">
          {english ? 'Hide English' : 'Show English'}
        </button>
        <button onClick={toggleCharsOnly} aria-pressed={charsOnly} className={`btn h-11 px-4 ${charsOnly ? 'btn-primary' : 'btn-quiet'}`}>
          Characters only
        </button>
      </div>
      {charsOnly && <p className="mt-2 text-sm text-muted">No pinyin. Tap a word to see it: that counts as a miss for reading it (words you read without tapping aren't graded).</p>}
      <VolumeSlider className="mt-3" />

      <article className="mt-7 flex flex-col gap-6">
        {story.paragraphs.map((p, pi) => {
          const { tokens } = segmentWithVocab(p.zh, vocab);
          const readings = py ? py(p.zh) : null;
          let offset = 0;
          return (
            <div key={pi} className={`-mx-3 rounded-2xl px-3 py-2 transition-colors duration-300 ${reading === pi ? 'bg-jade-soft/60' : ''}`}>
              <div className="flex items-start gap-2">
              <p className="han flex min-w-0 flex-1 flex-wrap items-start gap-x-0.5 gap-y-1 text-2xl leading-snug" lang="zh-CN">
                {groupPunctuation(tokens).map((g, gi) => (
                  <span key={gi} className="inline-flex items-start">
                    {g.map((t, ti) => {
                  if (!t.word)
                    return (
                      <span key={ti} className="self-start">
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
                      <span>{t.text}</span>
                      {!charsOnly && <TonePinyin pinyin={reading || ' '} className="mt-1 font-sans text-[0.5em] leading-none" />}
                    </button>
                  );
                    })}
                  </span>
                ))}
              </p>
              <button
                onClick={() => (reading === pi ? stopReading() : void playFrom(pi, false))}
                aria-label={`Read paragraph ${pi + 1} aloud`}
                className={`mt-1 shrink-0 rounded-full p-2 transition-colors ${reading === pi ? 'bg-jade text-jade-ink' : 'text-muted hover:bg-sunk hover:text-ink'}`}
              >
                <Speaker className="h-5 w-5" />
              </button>
              </div>
              {english && <p className="anim-fade mt-2 leading-relaxed text-muted">{p.en}</p>}
            </div>
          );
        })}
      </article>

      {story.extra.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          <span className="border-b-2 border-dotted border-gold">Dotted</span> words aren't in the HSK list.
        </p>
      )}

      {picked && (
        <WordPopover text={picked.text} entry={picked.entry} gloss={picked.gloss} audioId={picked.audioId}
          anchor={picked.anchor} onClose={() => setPicked(null)} />
      )}
    </div>
  );
}
