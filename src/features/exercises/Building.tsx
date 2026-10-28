import { useEffect, useRef, useState } from 'react';
import { sentences, words } from '../../content';
import { alignSyllables, SentenceText, ToneText } from '../../components/Hanzi';
import { hanziOnly } from '../../lib/pinyin';
import { useSettings } from '../../lib/settings';
import { useCheck, useLesson } from '../lesson/context';
import type { Exercise, Outcome } from '../lesson/types';
import { AudioControls, PinyinInput, Prompt } from './parts';
import { altPinyin, checkTyped } from './check';

type Of<K extends Exercise['kind']> = Extract<Exercise, { kind: K }>;

/**
 * Build a sentence from word tiles (word ids, duplicates allowed).
 * Tap a tile to add or remove it, or drag: drag a tile from the pool into
 * the answer at any position, drag answer tiles to reorder, or drag one out
 * of the answer to remove it.
 */
function TileBoard({ tiles, chosen, setChosen }: { tiles: string[]; chosen: number[]; setChosen: (c: number[]) => void }) {
  const { locked } = useLesson();
  const { pinyinDisplay } = useSettings();
  const showPy = pinyinDisplay === 'always' || pinyinDisplay === 'hover';
  const hoverPy = pinyinDisplay === 'hover';
  const answerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  /** Where in the answer a tile dropped at (x, y) would go, or null if outside the answer. */
  const dropIndex = (x: number, y: number, skipPos: number | null): number | null => {
    const box = answerRef.current?.getBoundingClientRect();
    if (!box || x < box.left - 24 || x > box.right + 24 || y < box.top - 32 || y > box.bottom + 32) return null;
    let idx = 0;
    chosen.forEach((_, pos) => {
      if (pos === skipPos) return;
      const r = slotRefs.current[pos]?.getBoundingClientRect();
      if (!r) return;
      const sameRow = y >= r.top && y <= r.bottom;
      if (y > r.bottom || (sameRow && x > r.left + r.width / 2)) idx++;
    });
    return idx;
  };

  const onDown = (e: React.PointerEvent, tile: number, pos: number | null) => {
    if (locked || e.button > 0) return;
    setDrag({ tile, pos, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moving: false, target: null });
  };
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const moving = d.moving || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6;
    setDrag({ ...d, x: e.clientX, y: e.clientY, moving, target: moving ? dropIndex(e.clientX, e.clientY, d.pos) : null });
  };
  const onUp = () => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (!d.moving) {
      // A plain tap
      if (d.pos !== null) setChosen(chosen.filter((_, j) => j !== d.pos));
      else if (!chosen.includes(d.tile)) setChosen([...chosen, d.tile]);
      return;
    }
    const rest = d.pos !== null ? chosen.filter((_, j) => j !== d.pos) : chosen.filter((t) => t !== d.tile);
    if (d.target === null) setChosen(rest); // dragged out of the answer: remove it
    else setChosen([...rest.slice(0, d.target), d.tile, ...rest.slice(d.target)]);
  };

  const face = (i: number, hidden = false) => {
    const w = words.get(tiles[i])!;
    return (
      <>
        {showPy && <span className={`text-xs ${hidden ? 'invisible' : hoverPy ? 'invisible text-muted group-hover:visible' : 'text-muted'}`}>{w.pinyin}</span>}
        <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className={`han text-2xl ${hidden ? 'invisible' : ''}`} />
      </>
    );
  };
  const tileClass = 'group flex min-h-12 touch-none select-none flex-col items-center justify-center rounded-xl border border-b-4 px-3 py-1.5 transition';
  // While dragging, follow the pointer anywhere on the page (tiles re-render under it).
  const live = useRef({ onMove, onUp });
  live.current = { onMove, onUp };
  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => live.current.onMove(e);
    const up = () => live.current.onUp();
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging]);
  const handlers = (tile: number, pos: number | null) => ({
    onPointerDown: (e: React.PointerEvent) => onDown(e, tile, pos),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      if (pos !== null) setChosen(chosen.filter((_, j) => j !== pos));
      else if (!chosen.includes(tile)) setChosen([...chosen, tile]);
    },
  });

  const moving = drag?.moving ? drag : null;
  const answer: Array<{ tile: number; pos: number } | 'gap'> = chosen.map((tile, pos) => ({ tile, pos }));
  if (moving && moving.target !== null) {
    // Show where the tile will land.
    const visible = answer.filter((a) => a !== 'gap' && a.pos !== moving.pos);
    visible.splice(moving.target, 0, 'gap');
    answer.splice(0, answer.length, ...visible);
  }

  return (
    <div>
      <div ref={answerRef} className="mb-6 flex min-h-16 flex-wrap content-start gap-2 border-b-2 border-line pb-3" aria-label="Your answer">
        {answer.map((a) =>
          a === 'gap' ? (
            <span key="gap" className="anim-fade min-h-12 w-12 rounded-xl border border-dashed border-jade bg-jade-soft" aria-hidden />
          ) : (
            <button
              key={`tile-${a.tile}`}
              ref={(el) => {
                slotRefs.current[a.pos] = el;
              }}
              type="button"
              disabled={locked}
              {...handlers(a.tile, a.pos)}
              className={`${tileClass} anim-tile border-line bg-surface ${moving?.pos === a.pos ? 'opacity-30' : ''}`}
            >
              {face(a.tile)}
            </button>
          ),
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Word tiles">
        {tiles.map((_, i) => {
          const used = chosen.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={locked || used}
              {...handlers(i, null)}
              className={`${tileClass} ${used ? 'border-transparent bg-sunk text-transparent' : moving?.tile === i && moving.pos === null ? 'border-line bg-surface opacity-30' : 'border-line bg-surface'}`}
            >
              {face(i, used)}
            </button>
          );
        })}
      </div>
      {moving && (
        <div
          className={`${tileClass} pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 border-jade bg-surface shadow-lg`}
          style={{ left: moving.x, top: moving.y }}
          aria-hidden
        >
          {face(moving.tile)}
        </div>
      )}
    </div>
  );
}

interface Drag {
  tile: number; // index into tiles
  pos: number | null; // position in the answer, or null when dragged from the pool
  x0: number;
  y0: number;
  x: number;
  y: number;
  moving: boolean;
  target: number | null; // insertion index in the answer (without the dragged tile)
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

/** Word tiles, or (toggle) type the whole sentence in pinyin or characters. Remembered per device. */
const K_TYPE = 'tiles:type';
function useTypeMode(): [boolean, (v: boolean) => void] {
  const [typing, setTyping] = useState(() => {
    try {
      return localStorage.getItem(K_TYPE) === '1';
    } catch {
      return false;
    }
  });
  return [
    typing,
    (v: boolean) => {
      setTyping(v);
      try {
        localStorage.setItem(K_TYPE, v ? '1' : '0');
      } catch {
        // ignore
      }
    },
  ];
}

function TilesOrTyping({ sentenceId, tiles }: { sentenceId: string; tiles: string[] }) {
  const [typing, setTyping] = useTypeMode();
  const { locked } = useLesson();
  return (
    <div>
      {typing ? <TypedSentence sentenceId={sentenceId} /> : <Tiles sentenceId={sentenceId} tiles={tiles} />}
      {!locked && (
        <button type="button" onClick={() => setTyping(!typing)} className="mx-auto mt-5 block rounded-xl px-3 py-2 text-sm font-medium text-jade hover:bg-sunk">
          {typing ? 'Use word tiles instead' : 'Type it instead'}
        </button>
      )}
    </div>
  );
}

function Tiles({ sentenceId, tiles }: { sentenceId: string; tiles: string[] }) {
  const [chosen, setChosen] = useState<number[]>([]);
  useTileCheck(sentenceId, tiles, chosen);
  return <TileBoard tiles={tiles} chosen={chosen} setChosen={setChosen} />;
}

function TypedSentence({ sentenceId }: { sentenceId: string }) {
  const [text, setText] = useState('');
  const s = sentences.get(sentenceId)!;
  useCheck(text.trim() ? () => checkTyped(text, { hanzi: s.hanzi, pinyin: s.pinyin, english: s.english }, altPinyin(s)) : null, [text]);
  return <PinyinInput value={text} onChange={setText} placeholder="Type in pinyin or characters" />;
}

export function ListenTiles({ ex }: { ex: Of<'listen-tiles'> }) {
  return (
    <div>
      <Prompt>Put together what you hear</Prompt>
      <div className="mb-6">
        <AudioControls id={ex.sentenceId} voice={ex.voice} />
      </div>
      <TilesOrTyping sentenceId={ex.sentenceId} tiles={ex.tiles} />
    </div>
  );
}

export function BuildSentence({ ex }: { ex: Of<'build-sentence'> }) {
  const s = sentences.get(ex.sentenceId)!;
  return (
    <div>
      <Prompt>Say this in Chinese</Prompt>
      <p className="mb-6 rounded-2xl bg-sunk p-4 text-xl">{s.english}</p>
      <TilesOrTyping sentenceId={ex.sentenceId} tiles={ex.tiles} />
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
