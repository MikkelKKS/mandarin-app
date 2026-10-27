import { currentSettings } from '../../lib/settings';
import { checkPinyinAnswer, type ExpectedPinyin, type PinyinCheck, type SyllableFeedback } from '../../lib/pinyinAnswer';
import type { Outcome } from '../lesson/types';

/** Tones typed per syllable, for the tone statistics (0 = no tone or no matching syllable). */
function toneLog(r: PinyinCheck): Outcome['tones'] {
  const syl = r.syllables ?? [];
  if (!syl.some((x) => x.given)) return undefined;
  return { expected: syl.map((x) => x.tone ?? 0).join('-'), given: syl.map((x) => x.given ?? 0).join('-') };
}

const ordinal = (t?: number) => (t === 5 ? 'neutral' : t === 1 ? '1st' : t === 2 ? '2nd' : t === 3 ? '3rd' : t === 4 ? '4th' : '');

/** A short sentence naming the tone slips, e.g. "hǎo is 3rd tone, not 4th." */
function toneNote(syl: SyllableFeedback[]): string | undefined {
  const bad = syl.filter((s) => s.status === 'wrong-tone');
  const missing = syl.filter((s) => s.status === 'missing');
  const parts: string[] = [];
  if (bad.length === 1) parts.push(`${bad[0].expected} is ${ordinal(bad[0].tone)} tone, not ${ordinal(bad[0].given ?? undefined)}.`);
  else if (bad.length > 1) parts.push(`Wrong tone on ${bad.map((s) => s.expected).join(', ')}.`);
  if (missing.length) parts.push(`No tone on ${missing.map((s) => s.expected).join(', ')}.`);
  return parts.join(' ') || undefined;
}

/** Check typed pinyin and turn the result into feedback. */
export function checkTyped(
  input: string,
  expected: ExpectedPinyin & { english?: string },
  alternatives: ExpectedPinyin[] = [],
): Outcome {
  const strict = currentSettings().strictTones;
  const r = checkPinyinAnswer(input, expected, { strictTones: strict, alternatives });
  const answer = { hanzi: expected.hanzi, pinyin: r.correction, english: expected.english };
  const base = { answer, syllables: r.syllables, extra: r.extra, tones: toneLog(r) };
  switch (r.verdict) {
    case 'correct':
      return r.otherAnswer ? { ...base, verdict: 'correct', note: `Another correct answer: ${r.otherAnswer}` } : { ...base, verdict: 'correct' };
    case 'typo':
      return { ...base, verdict: 'typo', note: `Small typo. You wrote “${input.trim()}”.` };
    case 'almost':
      return { ...base, verdict: 'almost', note: `${toneNote(r.syllables ?? []) ?? 'Mind the tones.'} Counts as Hard.` };
    default: {
      let note: string | undefined;
      if (r.reason === 'missing-tones' || r.reason === 'wrong-tones') note = toneNote(r.syllables ?? []);
      else if (r.reason === 'mismatch' && r.syllables?.some((s) => s.status !== 'ok')) {
        const off = r.syllables.filter((s) => s.status === 'wrong-syllable' || s.status === 'skipped').length;
        const extra = r.extra?.length ?? 0;
        const bits: string[] = [];
        if (off) bits.push(r.syllables.length === 1 ? 'A different syllable.' : `${off} of ${r.syllables.length} syllables ${off === 1 ? 'is' : 'are'} different.`);
        if (extra) bits.push(`${extra} extra ${extra === 1 ? 'syllable' : 'syllables'}.`);
        note = bits.join(' ') || undefined;
        const tn = toneNote(r.syllables);
        if (tn) note = note ? `${note} ${tn}` : tn;
      }
      return { ...base, verdict: 'wrong', note, canOverride: r.reason === 'mismatch' };
    }
  }
}

/** Sentence alternatives (pinyin variants) for the checker. */
export function altPinyin(item: { hanzi: string; alt?: { pinyin?: string[] } }): ExpectedPinyin[] {
  return (item.alt?.pinyin ?? []).map((p) => ({ pinyin: p, hanzi: undefined }));
}
