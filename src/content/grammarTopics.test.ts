import { describe, expect, it } from 'vitest';
import { pinyin } from 'pinyin-pro';
import { TOPICS } from '../lib/grammarData';
import { filledIn, hanziOf, pinyinOf, sentenceOf, tokens, wordsOf, type Exercise } from '../lib/grammarTopics';
import { markSyllable, parsePinyin } from '../lib/pinyin';

/** Every sentence line in the content. */
function lines(): Array<{ where: string; line: string; blank?: boolean }> {
  const out: Array<{ where: string; line: string; blank?: boolean }> = [];
  for (const t of TOPICS) {
    t.examples.forEach((e, i) => out.push({ where: `${t.id} example ${i}`, line: e.t }));
    (t.mistakes ?? []).forEach((m, i) => {
      out.push({ where: `${t.id} mistake ${i} wrong`, line: m.wrong });
      out.push({ where: `${t.id} mistake ${i} right`, line: m.right });
    });
    t.exercises.forEach((x: Exercise, i) => {
      if (x.type === 'order') out.push({ where: `${t.id} ex ${i}`, line: x.t });
      if (x.type === 'choose') {
        out.push({ where: `${t.id} ex ${i}`, line: x.t, blank: true });
        out.push({ where: `${t.id} ex ${i} filled`, line: filledIn(x) });
        x.options.forEach((o, k) => out.push({ where: `${t.id} ex ${i} option ${k}`, line: o }));
      }
      if (x.type === 'spot') x.options.forEach((o, k) => out.push({ where: `${t.id} ex ${i} option ${k}`, line: o }));
      (x.type === 'order' ? (x.alt ?? []) : []).forEach((a, k) => out.push({ where: `${t.id} ex ${i} alt ${k}`, line: a }));
    });
  }
  return out;
}

// Readings pinyin-pro gets wrong in these sentences (or the dictionary tone we teach differs).
const OK_READINGS = new Set(['得|de', '地|de', '着|zhe', '了|le', '过|guo', '还|hái', '要|yào', '长|zhǎng', '觉|jiào', '行|xíng', '都|dōu', '只|zhī', '为|wèi', '倒|dào', '便|pián', '一|yí', '一|yì', '不|bú', '难|nán', '好|hǎo', '教|jiāo', '重|zhòng', '少|shǎo', '差|chà', '假|jià', '种|zhǒng', '得|dé', '得|děi', '把|bǎ', '上|shang', '下|xia', '里|li', '来|lai', '去|qu', '个|ge', '子|zi', '们|men', '么|me', '的|de', '吗|ma', '呢|ne', '吧|ba', '啊|a', '头|tou', '儿|r', '候|hou', '东|dong', '西|xi', '思|si', '服|fu', '友|you', '生|sheng', '欢|huan', '亮|liang', '爸|ba', '妈|ma', '哥|ge', '姐|jie', '弟|di', '妹|mei', '舍|she', '气|qi', '道|dao', '识|shi', '量|liang', '方|fang', '面|mian', '边|bian', '告|gao', '诉|su', '意|yi', '情|qing', '楚|chu', '息|xi', '客|ke', '虑|lü', '算|suan', '拾|shi', '音|yin', '先|xian', '外|wai', '谁|shéi']);

describe('grammar topics', () => {
  it('there are about 30 topics, with unique ids, text, examples and exercises', () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) {
      expect(t.text.length, t.id).toBeGreaterThan(0);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.exercises.length, t.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('every sentence is well formed: a pinyin syllable for each character', () => {
    for (const { where, line, blank } of lines()) {
      const toks = tokens(line);
      expect(toks.filter((x) => 'blank' in x).length, where).toBe(blank ? 1 : 0);
      for (const tk of toks) {
        if ('plain' in tk) expect(/\p{Script=Han}/u.test(tk.plain), `${where}: "${tk.plain}" needs a pinyin`).toBe(false);
        if ('h' in tk) {
          expect(/^[\p{Script=Han}]+$/u.test(tk.h), `${where}: "${tk.h}" has more than characters`).toBe(true);
          // 儿化: 哪儿 nǎr is two characters, one syllable.
          const er = tk.h.endsWith('儿') && /r$/.test(tk.p) && !/[ée]r$/.test(tk.p) ? 1 : 0;
          const n = [...tk.h].filter((c) => /\p{Script=Han}/u.test(c)).length - er;
          expect(parsePinyin(tk.p.replace(/\s+/g, ''), n)?.length, `${where}: ${tk.h}/${tk.p}`).toBe(n);
        }
      }
    }
  });

  it('pinyin agrees with the dictionary (pinyin-pro), apart from known readings', () => {
    const bad: string[] = [];
    for (const { where, line } of lines()) {
      for (const tk of wordsOf(line)) {
        if (tk.h.endsWith('儿') && /r$/.test(tk.p)) continue;
        const chars = [...tk.h];
        const mine = parsePinyin(tk.p.replace(/\s+/g, ''), chars.length);
        const ref = pinyin(tk.h, { type: 'array', toneSandhi: false });
        chars.forEach((c, i) => {
          const m = mine?.[i];
          if (!m) return;
          const r = parsePinyin(ref[i] ?? '')?.[0];
          if (!r) return;
          const sameBase = m.base === r.base;
          const sameTone = m.tone === r.tone || m.tone === 5 || r.tone === 5;
          const reading = `${c}|${ref[i]}`;
          if ((!sameBase || !sameTone) && !OK_READINGS.has(`${c}|${markSyllable(m)}`) && !OK_READINGS.has(reading)) bad.push(`${where}: ${tk.h}/${tk.p} (dictionary: ${ref.join(' ')})`);
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it('exercises are answerable', () => {
    for (const t of TOPICS)
      t.exercises.forEach((x, i) => {
        const where = `${t.id} ex ${i}`;
        if (x.type === 'order') expect(wordsOf(x.t).length, where).toBeGreaterThanOrEqual(3);
        if (x.type !== 'order') {
          expect(x.answer, where).toBeLessThan(x.options.length);
          expect(new Set(x.options).size, where).toBe(x.options.length);
        }
        expect(sentenceOf(x), where).toBeTruthy();
      });
  });

  it('formats lines', () => {
    expect(pinyinOf('我/wǒ 喝/hē 茶/chá 。')).toBe('Wǒ hē chá.');
    expect(hanziOf('我/wǒ _ 茶/chá 。')).toBe('我＿茶。');
    expect(pinyinOf('我/wǒ _ 茶/chá ？')).toBe('Wǒ ___ chá?');
  });
});

describe('spokenLine', () => {
  it('drops stage directions and "="', async () => {
    const { spokenLine, hanziOf } = await import('../lib/grammarTopics');
    expect(hanziOf(spokenLine('（ 你/nǐ 在/zài ） 请/qǐng 进/jìn 来/lai ！'))).toBe('请进来！');
    expect(hanziOf(spokenLine('他/tā 喝/hē 了/le 。 = 我/wǒ 喝/hē 了/le 。'))).toBe('他喝了。我喝了。');
  });
});

describe('grammar helpers', async () => {
  const g = await import('../lib/grammarTopics');
  it('order answers: the sentence or an alternative', () => {
    const ex = { type: 'order' as const, t: '我/wǒ 明天/míngtiān 去/qù 。', en: '', alt: ['明天/míngtiān 我/wǒ 去/qù 。'] };
    const w = (s: string) => s.split(' ').map((h) => ({ h }));
    expect(g.orderIsRight(ex, w('我 明天 去'))).toBe(true);
    expect(g.orderIsRight(ex, w('明天 我 去'))).toBe(true);
    expect(g.orderIsRight(ex, w('去 我 明天'))).toBe(false);
  });
  it('the shuffle never gives the answer away', () => {
    const items = [1, 2, 3];
    for (let k = 0; k < 20; k++) expect(g.shuffled(items, Math.random, (a) => a.join() === '1,2,3').join()).not.toBe('1,2,3');
  });
  it('practice grade: all right Good, one slip Hard, more Again', () => {
    expect(g.practiceRating(6, 6)).toBe('good');
    expect(g.practiceRating(5, 6)).toBe('hard');
    expect(g.practiceRating(3, 6)).toBe('again');
  });
  it('options are written without a capital, sentences with one', () => {
    expect(g.pinyinOf('了/le', false)).toBe('le');
    expect(g.pinyinOf('我/wǒ 来/lái 。')).toBe('Wǒ lái.');
  });
});
