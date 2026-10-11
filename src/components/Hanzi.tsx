/**
 * Displays Chinese text: tone-coloured characters, optional pinyin above,
 * and tap-to-look-up for every word.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { sentenceTokens, wordByHanzi } from '../content';
import type { Sentence, Word } from '../content/schema';
import { alignToHanzi, hanziOnly, isHanzi, markSyllable, parsePinyin, type Tone } from '../lib/pinyin';
import { useSettings } from '../lib/settings';
import { play } from '../lib/audio';
import { Speaker } from './icons';

const TONE_CLASS: Record<Tone, string> = {
  1: 'text-t1',
  2: 'text-t2',
  3: 'text-t3',
  4: 'text-t4',
  5: 'text-t5',
};

interface Syl {
  ch: string;
  pinyin?: string;
  tone?: Tone;
}

/** Pair each character of `hanzi` with its syllable from `pinyin`. Non-Han chars pass through. */
export function alignSyllables(hanzi: string, pinyin: string): Syl[] {
  const al = alignToHanzi(hanzi, pinyin);
  let k = 0;
  return [...hanzi].map((ch) => {
    if (!isHanzi(ch)) return { ch };
    const ci = k++;
    if (!al) return { ch };
    const si = al.charSyl[ci];
    const s = al.syls[si];
    // A merged 儿 takes the colour of its syllable but shows no pinyin of its own.
    if (ci > 0 && al.charSyl[ci - 1] === si) return { ch, pinyin: '', tone: s.tone };
    return { ch, pinyin: markSyllable(s), tone: s.tone };
  });
}

// ---------- popup ----------

const PopupCtx = createContext<(w: Word) => void>(() => {});

export function WordPopupProvider({ children }: { children: ReactNode }) {
  const [word, setWord] = useState<Word | null>(null);
  return (
    <PopupCtx.Provider value={setWord}>
      {children}
      {word && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setWord(null)}>
          <div
            role="dialog"
            aria-label={`${word.hanzi}: ${word.english[0]}`}
            className="anim-rise m-3 w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <ToneText hanzi={word.hanzi} pinyin={word.pinyin} className="han text-5xl font-medium" />
              <button
                className="ml-auto rounded-full bg-jade-soft p-3 text-jade"
                aria-label="Play"
                onClick={() => play(word.id)}
              >
                <Speaker className="h-6 w-6" />
              </button>
            </div>
            <p className="mt-2 text-lg text-muted">{word.pinyin}</p>
            <p className="mt-1 text-lg">{word.english.join('; ')}</p>
            {word.note && <p className="mt-3 text-sm text-muted">{word.note}</p>}
            <a
              href={`#/dictionary?q=${encodeURIComponent(word.hanzi)}`}
              onClick={() => setWord(null)}
              className="mt-3 inline-block text-sm text-jade underline underline-offset-2"
            >
              More in the dictionary
            </a>
            <button className="mt-4 w-full rounded-xl bg-sunk py-3 font-medium" onClick={() => setWord(null)} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </PopupCtx.Provider>
  );
}

export function useWordPopup() {
  return useContext(PopupCtx);
}

// ---------- text ----------

/** Characters coloured by tone (when enabled). */
export function ToneText({ hanzi, pinyin, className = '' }: { hanzi: string; pinyin: string; className?: string }) {
  const { toneColors } = useSettings();
  const syls = alignSyllables(hanzi, pinyin);
  return (
    <span className={className} lang="zh-CN">
      {syls.map((s, i) => (
        <span key={i} className={toneColors && s.tone ? TONE_CLASS[s.tone] : undefined}>
          {s.ch}
        </span>
      ))}
    </span>
  );
}

/** Pinyin with each syllable coloured by tone. */
export function TonePinyin({ pinyin, className = '' }: { pinyin: string; className?: string }) {
  const { toneColors } = useSettings();
  if (!toneColors) return <span className={className}>{pinyin}</span>;
  // Colour word by word; syllables inside a word share the colours of their tones.
  const parts = pinyin.split(/(\s+)/);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const syl = /\S/.test(p) ? parsePinyin(p) : null;
        if (!syl) return <span key={i}>{p}</span>;
        const trail = p.match(/[^\p{L}']+$/u)?.[0] ?? '';
        const lead = p.match(/^[^\p{L}]+/u)?.[0] ?? '';
        const capital = /^\P{Ll}/u.test(p.replace(/^[^\p{L}]+/u, ''));
        return (
          <span key={i}>
            {lead}
            {syl.map((s, j) => {
              let txt = markSyllable(s);
              if (j === 0 && capital) txt = txt.charAt(0).toUpperCase() + txt.slice(1);
              return (
                <span key={j} className={TONE_CLASS[s.tone]}>
                  {j > 0 && /^[aeoāáǎàēéěèōóǒò]/.test(txt) ? "'" : ''}
                  {txt}
                </span>
              );
            })}
            {trail}
          </span>
        );
      })}
    </span>
  );
}

/**
 * A sentence with tappable words. `pinyin` overrides the setting:
 * true = always show, false = never.
 */
export function SentenceText({
  sentence,
  pinyin,
  size = 'text-3xl',
  className = '',
}: {
  sentence: Pick<Sentence, 'hanzi' | 'pinyin' | 'words'>;
  pinyin?: boolean;
  size?: string;
  className?: string;
}) {
  const settings = useSettings();
  const open = useWordPopup();
  const showPinyin = pinyin ?? settings.pinyinDisplay === 'always';
  const syls = alignSyllables(sentence.hanzi, sentence.pinyin);
  const tokens = sentenceTokens(sentence as Sentence);

  // Group characters into word tokens (punctuation stands alone).
  const groups: Array<{ word?: Word; syls: Syl[] }> = [];
  let ti = 0;
  let i = 0;
  while (i < syls.length) {
    if (!syls[i].tone && !isHanzi(syls[i].ch)) {
      groups.push({ syls: [syls[i]] });
      i++;
      continue;
    }
    const w = tokens[ti++];
    const len = w ? [...hanziOnly(w.hanzi)].length : 1;
    const chunk: Syl[] = [];
    while (chunk.length < len && i < syls.length) {
      if (isHanzi(syls[i].ch)) chunk.push(syls[i]);
      else break;
      i++;
    }
    groups.push({ word: w ?? wordByHanzi(chunk.map((c) => c.ch).join('')), syls: chunk });
  }

  return (
    <span className={`han inline-flex flex-wrap items-end gap-x-1 ${size} ${className}`} lang="zh-CN">
      {groups.map((g, gi) =>
        g.word ? (
          <button
            key={gi}
            type="button"
            onClick={() => open(g.word!)}
            className="inline-flex rounded-md px-0.5 hover:bg-sunk"
            aria-label={`${g.word.hanzi} ${g.word.pinyin}: ${g.word.english[0]}`}
          >
            {g.syls.map((s, si) => (
              <Ruby key={si} s={s} showPinyin={showPinyin} toneColors={settings.toneColors} />
            ))}
          </button>
        ) : (
          <span key={gi} className="inline-flex">
            {g.syls.map((s, si) => (
              <Ruby key={si} s={s} showPinyin={showPinyin} toneColors={settings.toneColors} />
            ))}
          </span>
        ),
      )}
    </span>
  );
}

function Ruby({ s, showPinyin, toneColors }: { s: Syl; showPinyin: boolean; toneColors: boolean }) {
  const color = toneColors && s.tone ? TONE_CLASS[s.tone] : '';
  return (
    <span className="inline-flex flex-col items-center leading-none">
      {showPinyin && (
        <span className={`mb-1 font-sans text-[0.42em] leading-none ${s.pinyin ? color : 'invisible'}`}>{s.pinyin || '·'}</span>
      )}
      <span className={color}>{s.ch}</span>
    </span>
  );
}
