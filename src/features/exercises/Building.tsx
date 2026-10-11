import { useState } from 'react';
import { sentences, words } from '../../content';
import { alignSyllables, SentenceText, ToneText } from '../../components/Hanzi';
import { hanziOnly } from '../../lib/pinyin';
import { useSettings } from '../../lib/settings';
import { useCheck, useLesson } from '../lesson/context';
import type { Exercise, Outcome } from '../lesson/types';
import { AudioControls, PinyinInput, Prompt } from './parts';
import { checkTyped } from './check';

type Of<K extends Exercise['kind']> = Extract<Exercise, { kind: K }>;

/** Tap tiles to build a sentence. Tiles are word ids (duplicates allowed). */
function TileBoard({ tiles, chosen, setChosen }: { tiles: string[]; chosen: number[]; setChosen: (c: number[]) => void }) {
  const { locked } = useLesson();
  const { pinyinDisplay } = useSettings();
  const showPy = pinyinDisplay === 'always';
  const tile = (i: number, onClick: () => void, faded = false) => {
    const w = words.get(tiles[i])!;
    return (
      <button
        key={i}
        type="button"
        disabled={locked || faded}
        onClick={onClick}
        className={`flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-b-4 px-3 py-1.5 transition active:translate-y-0.5 ${faded ? 'border-transparent bg-sunk text-transparent' : 'border-line bg-surface'}`}
      >
        {showPy && <span className={`text-xs ${faded ? 'invisible' : 'text-muted'}`}>{w.pinyin}</span>}
        <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className={`han text-2xl ${faded ? 'invisible' : ''}`} />
      </button>
    );
  };
  return (
    <div>
      <div className="mb-6 flex min-h-16 flex-wrap content-start gap-2 border-b-2 border-line pb-3" aria-label="Your answer">
        {chosen.map((ti, pos) => tile(ti, () => setChosen(chosen.filter((_, j) => j !== pos))))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Word tiles">
        {tiles.map((_, i) => tile(i, () => setChosen([...chosen, i]), chosen.includes(i)))}
      </div>
    </div>
  );
}

function useTileCheck(sentenceId: string, tiles: string[], chosen: number[]) {
  const s = sentences.get(sentenceId)!;
  useCheck(
    chosen.length
      ? (): Outcome => {
          const built = chosen.map((i) => words.get(tiles[i])!.hanzi).join('');
          return {
            verdict: built === hanziOnly(s.hanzi) ? 'correct' : 'wrong',
            answer: { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english },
          };
        }
      : null,
    [chosen.join()],
  );
}

export function ListenTiles({ ex }: { ex: Of<'listen-tiles'> }) {
  const [chosen, setChosen] = useState<number[]>([]);
  useTileCheck(ex.sentenceId, ex.tiles, chosen);
  return (
    <div>
      <Prompt>Tap the words in the order you hear them</Prompt>
      <div className="mb-6">
        <AudioControls id={ex.sentenceId} voice={ex.voice} />
      </div>
      <TileBoard tiles={ex.tiles} chosen={chosen} setChosen={setChosen} />
    </div>
  );
}

export function BuildSentence({ ex }: { ex: Of<'build-sentence'> }) {
  const [chosen, setChosen] = useState<number[]>([]);
  const s = sentences.get(ex.sentenceId)!;
  useTileCheck(ex.sentenceId, ex.tiles, chosen);
  return (
    <div>
      <Prompt>Say this in Chinese</Prompt>
      <p className="mb-6 rounded-2xl bg-sunk p-4 text-xl">{s.english}</p>
      <TileBoard tiles={ex.tiles} chosen={chosen} setChosen={setChosen} />
    </div>
  );
}

export function EnToPinyin({ ex }: { ex: Of<'en-to-pinyin'> }) {
  const [text, setText] = useState('');
  const w = words.get(ex.itemId);
  const s = sentences.get(ex.itemId);
  const expected = w ? { hanzi: w.hanzi, pinyin: w.pinyin, english: w.english.join('; ') } : { hanzi: s!.hanzi, pinyin: s!.pinyin, english: s!.english };
  const alts = (s?.alt?.pinyin ?? []).map((p) => ({ pinyin: p }));
  useCheck(text.trim() ? () => checkTyped(text, expected, alts) : null, [text]);
  return (
    <div>
      <Prompt>Write this in pinyin</Prompt>
      <p className="mb-2 rounded-2xl bg-sunk p-4 text-xl">{w ? w.english.join(' / ') : s!.english}</p>
      {w?.pos === 'name' && <p className="mb-2 text-sm text-muted">(a name)</p>}
      <div className="mt-4">
        <PinyinInput value={text} onChange={setText} />
      </div>
    </div>
  );
}

export function FillGap({ ex }: { ex: Of<'fill-gap'> }) {
  const [text, setText] = useState('');
  const { locked } = useLesson();
  const s = sentences.get(ex.sentenceId)!;
  const tokens = s.words.map((id) => words.get(id)!);
  // Pinyin for the gap word as spoken in this sentence (e.g. 不 → bú).
  const syls = alignSyllables(s.hanzi, s.pinyin).filter((x) => x.pinyin);
  const offset = tokens.slice(0, ex.gap).reduce((n, w) => n + [...hanziOnly(w.hanzi)].length, 0);
  const gapWord = tokens[ex.gap];
  const gapLen = [...hanziOnly(gapWord.hanzi)].length;
  const gapPinyin = syls.slice(offset, offset + gapLen).map((x) => x.pinyin).join('');
  useCheck(
    text.trim()
      ? () => {
          const o = checkTyped(text, { hanzi: gapWord.hanzi, pinyin: gapPinyin, english: gapWord.english[0] }, [{ pinyin: gapWord.pinyin, hanzi: gapWord.hanzi }]);
          return { ...o, items: [{ id: s.id, verdict: o.verdict }, { id: gapWord.id, verdict: o.verdict }] };
        }
      : null,
    [text],
  );
  return (
    <div>
      <Prompt>Fill the gap in pinyin</Prompt>
      <div className="mb-3 rounded-2xl bg-sunk p-4">
        {locked ? (
          <SentenceText sentence={s} size="text-2xl" />
        ) : (
          <span className="han flex flex-wrap items-end gap-1 text-3xl" lang="zh-CN">
            {tokens.map((w, i) =>
              i === ex.gap ? (
                <span key={i} className="mx-1 inline-block min-w-12 border-b-4 border-jade text-transparent">
                  {'口'.repeat(gapLen)}
                </span>
              ) : (
                <ToneText key={i} hanzi={w.hanzi} pinyin={w.pinyin} />
              ),
            )}
          </span>
        )}
        <p className="mt-3 text-muted">{s.english}</p>
      </div>
      <PinyinInput value={text} onChange={setText} placeholder="The missing word in pinyin" />
    </div>
  );
}
