/**
 * The Reading exercises (CLAUDE.md §3.5), used by the Reading tab and the
 * Reading block of deep sessions:
 * - meet: a word's characters, with their sound, meaning and building blocks;
 * - character → pinyin: typed, auto-graded with the usual scorer;
 * - character → meaning: guess (optional), reveal, grade yourself.
 * After every answer the item's recording plays, so the shape links to the sound.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { Speaker } from '../../components/icons';
import { isKnownState, isStartedState, useWordStates } from '../../lib/knowledge';
import { play, playUrl } from '../../lib/audio';
import { lookalikesOf, type ReadItem } from '../../lib/reading';
import type { RatingName } from '../../lib/review';
import { checkTyped } from '../exercises/check';
import { Prompt } from '../exercises/parts';
import { useCheck } from '../lesson/context';
import type { Outcome } from '../lesson/types';
import { meaningMatches } from '../session/meaning';
import type { SItem } from '../session/plan';
import { SelfGrade, TypeBox, useTyped, type ItemResult } from '../session/items';
import { syllableUrl } from '../tonegym/model';
import { useReadData, wordsWith, type ReadData } from './data';

const BASE = import.meta.env.BASE_URL;

/** The item's recording: its word's, else a real recording of the character's syllable (Tone Perfect). */
export function playItem(d: ReadData, it: ReadItem): void {
  const w = it.word ? d.vocab.byId.get(it.word) : undefined;
  if (w && (w.azure || w.course)) {
    void play(w.id);
    return;
  }
  const url = syllableUrl(it.pinyin, BASE);
  if (url) void playUrl(url);
}

type Kind = Extract<SItem, { kind: 'read-intro' | 'read-pinyin' | 'read-meaning' }>;

export function ReadingItem({ item, onResult }: { item: Kind; onResult: (r: ItemResult) => void }) {
  const d = useReadData();
  if (!d) return <p className="p-8 text-center text-muted">Loading characters…</p>;
  const it = d.index.items.get(item.item);
  if (!it)
    return (
      <button onClick={() => onResult({ outcome: { verdict: 'correct' }, skipFeedback: true })} className="h-12 w-full rounded-2xl border border-line">
        Skip (this item is no longer in the word list)
      </button>
    );
  if (item.kind === 'read-intro') return <ReadIntro d={d} it={it} via={item.via} onResult={onResult} />;
  if (item.kind === 'read-pinyin') return <ReadPinyin d={d} it={it} onResult={onResult} />;
  return <ReadMeaning d={d} it={it} onResult={onResult} />;
}

function Big({ text }: { text: string }) {
  return (
    <p className={`han text-center font-medium leading-none ${[...text].length > 2 ? 'text-6xl' : 'text-8xl'}`} lang="zh-CN">
      {text}
    </p>
  );
}

function PlayButton({ d, it }: { d: ReadData; it: ReadItem }) {
  return (
    <button onClick={() => playItem(d, it)} aria-label="Play the recording" className="rounded-full bg-jade-soft p-3 text-jade active:scale-90">
      <Speaker className="h-6 w-6" />
    </button>
  );
}

/** "妈 = 女 woman + 马 mǎ, which gives the sound", or the origin hint, from Make Me a Hanzi. */
export function BuildingBlocks({ d, c }: { d: ReadData; c: string }) {
  const h = d.chars[c];
  if (!h) return null;
  const parts = h.parts ?? [];
  const sound = parts.find((p) => p[3] === 'sound');
  const showHint = h.hint && h.type !== 'pictophonetic';
  if (!parts.length && !showHint) return null;
  return (
    <div className="text-sm leading-relaxed">
      {parts.length > 0 && (
        <p>
          <span className="han" lang="zh-CN">
            {c}
          </span>
          {' = '}
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && ' + '}
              <span className="han" lang="zh-CN">
                {p[0]}
              </span>
              {p[3] === 'sound' && p[1] ? (
                <>
                  {' '}
                  <TonePinyin pinyin={p[1]} />
                </>
              ) : p[2] ? (
                <span className="text-muted"> “{p[2]}”</span>
              ) : null}
            </span>
          ))}
          {sound && <span className="text-muted">, which gives the sound</span>}
        </p>
      )}
      {showHint && <p className="text-muted">{h.hint}</p>}
    </div>
  );
}

/** Pinyin, meaning, building blocks; for a character, 1–2 known words with it; for a word, each character. */
function Details({ d, it, example = false }: { d: ReadData; it: ReadItem; example?: boolean }) {
  const states = useWordStates();
  const known = (id: string) => isKnownState(states?.get(id)) || isStartedState(states?.get(id));
  const ws = wordsWith(d, it, known);
  const w = it.word ? d.vocab.byId.get(it.word) : undefined;
  const ex = example && it.kind === 'word' && w ? w.examples.map((e) => d.vocab.sentences.get(e)).find(Boolean) : undefined;
  return (
    <div className="flex flex-col gap-3 text-left">
      {it.kind === 'char' ? (
        <BuildingBlocks d={d} c={it.hanzi} />
      ) : (
        <ul className="flex flex-col gap-2">
          {it.chars.map((cid) => {
            const c = d.index.items.get(cid);
            if (!c) return null;
            return (
              <li key={cid} className="rounded-xl bg-sunk/60 px-3 py-2">
                <p>
                  <span className="han text-xl" lang="zh-CN">
                    {c.hanzi}
                  </span>{' '}
                  <TonePinyin pinyin={c.pinyin} className="font-semibold" /> <span className="text-sm text-muted">{c.meaning}</span>
                </p>
                <BuildingBlocks d={d} c={c.hanzi} />
              </li>
            );
          })}
        </ul>
      )}
      {ws.length > 0 && (
        <div className="text-sm">
          <p className="text-muted">In words you know:</p>
          {ws.map((id) => {
            const x = d.vocab.byId.get(id)!;
            return (
              <p key={id}>
                <span className="han" lang="zh-CN">
                  {x.hanzi}
                </span>{' '}
                <TonePinyin pinyin={x.pinyin} /> <span className="text-muted">{d.index.items.get(id)?.meaning ?? x.gloss[0]}</span>
              </p>
            );
          })}
        </div>
      )}
      {ex && (
        <div className="text-sm">
          <p className="han text-lg" lang="zh-CN">
            {ex.hanzi}
          </p>
          <TonePinyin pinyin={ex.pinyin} className="block" />
          <p className="text-muted">{ex.english[0]}</p>
        </div>
      )}
    </div>
  );
}

/** Look-alikes of the item's characters, side by side with their meaning and pinyin. */
export function Lookalikes({ d, it }: { d: ReadData; it: ReadItem }) {
  const sets = [...new Set([...it.hanzi])]
    .map((c) => ({ c, others: lookalikesOf(c, d.groups).filter((x) => d.index.itemOfChar.has(x) || d.chars[x]) }))
    .filter((s) => s.others.length);
  if (!sets.length) return null;
  const info = (c: string) => {
    const item = d.index.items.get(d.index.itemOfChar.get(c) ?? '');
    return { pinyin: item?.pinyin ?? d.chars[c]?.py ?? '', meaning: item?.meaning ?? d.chars[c]?.def ?? '' };
  };
  return (
    <div className="text-left">
      <p className="text-sm font-semibold">Don't mix them up</p>
      {sets.map((s) => (
        <div key={s.c} className="mt-2 flex gap-2 overflow-x-auto" role="list">
          {[s.c, ...s.others].map((c) => {
            const x = info(c);
            return (
              <div key={c} role="listitem" className={`min-w-24 flex-1 rounded-xl border px-3 py-2 text-center ${c === s.c ? 'border-jade bg-surface' : 'border-line bg-surface/60'}`}>
                <p className="han text-4xl leading-tight" lang="zh-CN">
                  {c}
                </p>
                <TonePinyin pinyin={x.pinyin} className="block font-semibold" />
                <p className="text-xs text-muted">{x.meaning}</p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ReadIntro({ d, it, via, onResult }: { d: ReadData; it: ReadItem; via?: string; onResult: (r: ItemResult) => void }) {
  const from = via ? d.index.items.get(via) : undefined;
  useEffect(() => {
    const t = setTimeout(() => playItem(d, it), 250);
    return () => clearTimeout(t);
  }, [d, it]);
  const done = () => onResult({ outcome: { verdict: 'correct' }, skipFeedback: true });
  useCheck(() => {
    done();
    return null as unknown as Outcome;
  }, []);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm font-medium text-jade">{from ? `A character in ${from.hanzi}` : it.kind === 'word' ? 'New word to read' : 'New character to read'}</p>
      <div className="mt-6">
        <Big text={it.hanzi} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <TonePinyin pinyin={it.pinyin} className="text-3xl font-semibold" />
        <PlayButton d={d} it={it} />
      </div>
      <p className="mt-2 text-xl">{it.meaning}</p>
      {it.alt.length > 0 && <p className="mt-1 text-sm text-muted">Also read {it.alt.join(', ')}</p>}
      <div className="mt-6 w-full rounded-2xl border border-line bg-surface p-4">
        <Details d={d} it={it} example />
      </div>
      <button onClick={done} className="press mt-8 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
        Got it
      </button>
    </div>
  );
}

function ReadPinyin({ d, it, onResult }: { d: ReadData; it: ReadItem; onResult: (r: ItemResult) => void }) {
  const expected = { pinyin: it.pinyin, hanzi: it.hanzi, english: it.meaning };
  const t = useTyped(
    expected,
    (r) => {
      playItem(d, it);
      const wrong = r.outcome.verdict === 'wrong';
      onResult({
        ...r,
        outcome: { ...r.outcome, answer: undefined, canOverride: wrong },
        audio: () => playItem(d, it),
        panel: <ReadAnswer d={d} it={it} lookalikes={wrong} />,
      });
    },
    (text) => checkTyped(text, expected, it.alt.map((p) => ({ pinyin: p, hanzi: it.hanzi }))),
  );
  return (
    <div>
      <Prompt>Read it: type the pinyin with tones</Prompt>
      <div className="rounded-2xl border border-line bg-surface py-8">
        <Big text={it.hanzi} />
      </div>
      <TypeBox {...t} />
    </div>
  );
}

/** The answer in the feedback panel: the item, its sound and meaning, building blocks, look-alikes after a miss. */
function ReadAnswer({ d, it, lookalikes }: { d: ReadData; it: ReadItem; lookalikes: boolean }) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="han text-4xl" lang="zh-CN">
          {it.hanzi}
        </span>
        <div className="min-w-0">
          <TonePinyin pinyin={it.pinyin} className="block text-2xl font-semibold" />
          <p className="opacity-80">{it.meaning}</p>
        </div>
      </div>
      {lookalikes && <Lookalikes d={d} it={it} />}
      <Details d={d} it={it} />
    </div>
  );
}

function ReadMeaning({ d, it, onResult }: { d: ReadData; it: ReadItem; onResult: (r: ItemResult) => void }) {
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState('');
  const graded = useRef(false);
  const w = it.word ? d.vocab.byId.get(it.word) : undefined;
  const match = useMemo(() => (shown && typed.trim() ? meaningMatches(typed, [it.meaning, ...(w?.gloss ?? [])]) : null), [shown, typed, it, w]);
  const reveal = () => {
    if (shown) return;
    setShown(true);
    playItem(d, it);
  };
  useCheck(() => {
    reveal();
    return null as unknown as Outcome;
  }, [shown]);
  const hasLookalikes = [...it.hanzi].some((c) => lookalikesOf(c, d.groups).length);
  const grade = (r: RatingName) => {
    if (graded.current) return;
    graded.current = true;
    const verdict = r === 'again' ? 'wrong' : r === 'hard' ? 'almost' : 'correct';
    // A miss on a character with look-alikes: show them side by side before moving on.
    if (r === 'again' && hasLookalikes) onResult({ outcome: { verdict }, rating: r, audio: () => playItem(d, it), panel: <ReadAnswer d={d} it={it} lookalikes /> });
    else onResult({ outcome: { verdict }, rating: r, skipFeedback: true });
  };
  return (
    <div>
      <Prompt>What does it mean?</Prompt>
      <div className="rounded-2xl border border-line bg-surface py-8">
        <Big text={it.hanzi} />
      </div>
      {!shown ? (
        <div className="mt-6">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), reveal())}
            placeholder="Type your guess (optional)"
            aria-label="Your guess in English"
            autoComplete="off"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-lg outline-none focus:border-jade"
          />
          <button onClick={reveal} className="press mt-3 h-14 w-full rounded-2xl bg-jade text-lg font-semibold text-jade-ink">
            Reveal
          </button>
        </div>
      ) : (
        <div className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TonePinyin pinyin={it.pinyin} className="block text-3xl font-semibold" />
              <p className="mt-1 text-lg">{it.meaning}</p>
            </div>
            <PlayButton d={d} it={it} />
          </div>
          {match !== null && <p className={`mt-1 text-sm ${match ? 'text-jade' : 'text-muted'}`}>{match ? 'Your guess matches.' : `You wrote “${typed.trim()}”.`}</p>}
          <div className="mt-4 border-t border-line pt-3">
            <Details d={d} it={it} example />
          </div>
          <SelfGrade onGrade={grade} suggest={match === true ? 'good' : match === false ? 'again' : undefined} />
        </div>
      )}
    </div>
  );
}
