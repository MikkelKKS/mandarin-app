/**
 * The optional Beijing pack (CLAUDE.md §1): 儿化 words and Beijing everyday
 * words from the course (the "Beijing flavour" unit, every …儿 word, and a few
 * local favourites). When it's on, these come first among new words.
 */
import { units } from '../../content';
import { newWordId } from '../../lib/review';

const EXTRA = new Set(['涮羊肉', '炸酱面', '广场舞', '师傅', '刷碗', '一点儿', '玩儿', '咱们']);
const NOT_ERHUA = new Set(['女儿', '儿子', '儿童', '婴儿', '儿女']);

/** HSK 3.0 ids of the pack's words, in course order. */
export function beijingWords(): string[] {
  const out: string[] = [];
  for (const u of units)
    for (const w of u.words) {
      const pack = u.id === 'u13-beijing' || EXTRA.has(w.hanzi) || (/.儿$/.test(w.hanzi) && !NOT_ERHUA.has(w.hanzi));
      const id = pack ? newWordId(w.id) : undefined;
      if (id && !out.includes(id)) out.push(id);
    }
  return out;
}

/** The learning order with the pack's words first (when it's on). */
export function wordOrder(ids: string[], beijing: boolean): string[] {
  if (!beijing) return ids;
  const pack = beijingWords().filter((id) => ids.includes(id));
  const set = new Set(pack);
  return [...pack, ...ids.filter((id) => !set.has(id))];
}
