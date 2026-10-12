import { currentSettings } from '../../lib/settings';
import { checkPinyinAnswer, type ExpectedPinyin } from '../../lib/pinyinAnswer';
import type { Outcome } from '../lesson/types';

/** Check typed pinyin and turn the result into feedback. */
export function checkTyped(
  input: string,
  expected: ExpectedPinyin & { english?: string },
  alternatives: ExpectedPinyin[] = [],
): Outcome {
  const r = checkPinyinAnswer(input, expected, { strictTones: currentSettings().strictTones, alternatives });
  const answer = { hanzi: expected.hanzi, pinyin: r.correction, english: expected.english };
  switch (r.verdict) {
    case 'correct':
      return r.otherAnswer ? { verdict: 'correct', answer, note: `Another correct answer: ${r.otherAnswer}` } : { verdict: 'correct', answer };
    case 'typo':
      return { verdict: 'typo', answer, note: `Small typo. You wrote “${input.trim()}”.` };
    case 'almost':
      return { verdict: 'almost', answer, note: 'Almost! Remember the tones:' };
    default: {
      let note: string | undefined;
      let tones: Outcome['tones'];
      if (r.reason === 'missing-tones') note = 'Strict tones are on, so tones are required.';
      else if (r.reason === 'wrong-tones') {
        const bad = r.syllables?.filter((s) => s.status === 'wrong-tone').map((s) => s.expected);
        note = bad?.length ? `Check the tone on ${bad.join(', ')}.` : 'Check the tones.';
        // Log which tones were confused, for the Progress page (0 = no tone typed).
        const syl = r.syllables ?? [];
        tones = { expected: syl.map((x) => x.tone ?? 0).join('-'), given: syl.map((x) => x.given ?? 0).join('-') };
      }
      return { verdict: 'wrong', answer, note, tones, canOverride: r.reason === 'mismatch' };
    }
  }
}

/** Sentence alternatives (pinyin variants) for the checker. */
export function altPinyin(item: { hanzi: string; alt?: { pinyin?: string[] } }): ExpectedPinyin[] {
  return (item.alt?.pinyin ?? []).map((p) => ({ pinyin: p, hanzi: undefined }));
}
