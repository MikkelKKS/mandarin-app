/** Saving a sentence from the dictionary into your practice, and the list of saved ones. */
import { useEffect, useMemo, useState } from 'react';
import { TonePinyin } from '../../components/Hanzi';
import { isHanzi } from '../../lib/pinyin';
import { usePinyinFn } from '../../lib/pinyinPro';
import { hasRecording, mySentenceId, removeMySentence, saveMySentence, useMySentences } from '../../lib/mySentences';
import { useVocab } from '../../lib/vocabData';
import { segment, type Dict } from './dict';
import { matchHsk } from './mywords';
import { translate } from './translate';

const PUNCT: Record<string, string> = { '，': ',', '。': '.', '？': '?', '！': '!', '、': ',', '：': ':', '；': ';', '“': '"', '”': '"' };

/** Pure: pinyin for a sentence, word by word (syllables from pinyin-pro, one per character), with its punctuation. */
export function sentencePinyin(dict: Dict, hanzi: string, readings: string[]): string {
  let i = 0;
  const out: string[] = [];
  for (const t of segment(dict, hanzi)) {
    const chars = [...t.text];
    if (chars.some(isHanzi)) {
      out.push(chars.map(() => readings[i++] ?? '').join(''));
    } else {
      const p = chars.map((c) => PUNCT[c] ?? c).join('').trim();
      if (!p) continue;
      if (out.length && /^[,.?!:;"]+$/.test(p)) out[out.length - 1] += p;
      else out.push(p);
    }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Under a sentence in the dictionary: check its pinyin and English, then save
 * it. Saved sentences come into your sessions (say it in pinyin from your English;
 * dictation once it's recorded).
 */
export function SaveSentenceCard({ dict, hanzi }: { dict: Dict; hanzi: string }) {
  const py = usePinyinFn();
  const vocab = useVocab();
  const mine = useMySentences();
  const id = mySentenceId(hanzi);
  const saved = mine?.some((s) => s.id === id);
  const [open, setOpen] = useState(false);
  const [pinyin, setPinyin] = useState('');
  const [english, setEnglish] = useState('');
  const [busy, setBusy] = useState(false);
  const guess = useMemo(() => (py ? sentencePinyin(dict, hanzi, py(hanzi)) : ''), [py, dict, hanzi]);

  useEffect(() => {
    if (!open) return;
    setPinyin((p) => p || guess);
    const ctl = new AbortController();
    translate(hanzi, 'zh-en', ctl.signal)
      .then((r) => setEnglish((e) => e || r.text))
      .catch(() => {});
    return () => ctl.abort();
  }, [open, guess, hanzi]);

  if (saved)
    return (
      <p className="mt-3 rounded-2xl bg-jade-soft p-3 text-sm text-jade" role="status">
        ✓ In your sentences. Your sessions practise it.
      </p>
    );
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-3 h-11 w-full rounded-2xl border border-jade font-medium text-jade">
        + Save this sentence for practice
      </button>
    );
  const save = async () => {
    setBusy(true);
    const words = vocab
      ? [
          ...new Set(
            segment(dict, hanzi)
              .filter((t) => t.entries.length)
              .map((t) => matchHsk(vocab, { hanzi: t.text, pinyin: t.entries[0].pinyin })?.id)
              .filter((x): x is string => !!x),
          ),
        ]
      : [];
    await saveMySentence({ hanzi, pinyin, english, words });
    setBusy(false);
  };
  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">Save for practice</h3>
      <p className="mt-0.5 text-sm text-muted">Check the pinyin and the English: your sessions ask you to say it from the English, so make it yours.</p>
      <label className="mt-3 block text-sm font-medium" htmlFor="my-py">
        Pinyin
      </label>
      <input id="my-py" value={pinyin} onChange={(e) => setPinyin(e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-jade" />
      {pinyin && <TonePinyin pinyin={pinyin} className="mt-1 block text-sm" />}
      <label className="mt-3 block text-sm font-medium" htmlFor="my-en">
        English
      </label>
      <input id="my-en" value={english} onChange={(e) => setEnglish(e.target.value)} placeholder="What it means" autoComplete="off" className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-jade" />
      <div className="mt-4 flex gap-2">
        <button onClick={() => void save()} disabled={busy || !pinyin.trim() || !english.trim()} className="press h-11 flex-1 rounded-2xl bg-jade font-semibold text-jade-ink disabled:bg-sunk disabled:text-muted">
          {busy ? 'Saving…' : 'Save sentence'}
        </button>
        <button onClick={() => setOpen(false)} className="h-11 rounded-2xl border border-line px-4 font-medium">
          Cancel
        </button>
      </div>
    </section>
  );
}

/** Your saved sentences, newest first, with remove. */
export function MySentenceList() {
  const mine = useMySentences();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!mine) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-muted">Your sentences ({mine.length})</h2>
      {mine.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">Type or paste a Chinese sentence above (or an English one, then “Break it down”) and tap “Save this sentence for practice”.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {[...mine]
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <p className="han text-lg" lang="zh-CN">
                  {s.hanzi}
                </p>
                <TonePinyin pinyin={s.pinyin} className="block text-sm" />
                <p className="text-sm text-muted">{s.english}</p>
                <p className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{hasRecording(s.id) ? 'Recorded: also practised as dictation' : 'Recording comes with the next audio update'}</span>
                  {confirm === s.id ? (
                    <button onClick={() => void removeMySentence(s.id)} className="font-medium text-cinnabar underline">
                      Remove it
                    </button>
                  ) : (
                    <button onClick={() => setConfirm(s.id)} className="underline">
                      Remove
                    </button>
                  )}
                </p>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
