/**
 * The 30-item audio sample for approval before bulk generation (CLAUDE.md §6):
 * third-tone sandhi, 不 and 一, neutral tones, 儿化, polyphones (行 长 了 得 还),
 * minimal tone pairs and a few sentences. Each item says what to listen for.
 */
export interface SampleItem {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  /** What to listen for. */
  check: string;
  sentence?: boolean;
}

export const SAMPLE: SampleItem[] = [
  // Third-tone sandhi and half third tone
  { id: 'nihao', hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello', check: '3+3: the first syllable rises (ní hǎo)' },
  { id: 'keyi', hanzi: '可以', pinyin: 'kěyǐ', english: 'can, may', check: '3+3: kéyǐ' },
  { id: 'wohenmang', hanzi: '我很忙。', pinyin: 'Wǒ hěn máng.', english: "I'm busy.", check: 'half third tones: low and short, not dipping', sentence: true },
  { id: 'xiangmai', hanzi: '我也想买。', pinyin: 'Wǒ yě xiǎng mǎi.', english: 'I want to buy one too.', check: 'four 3rd tones in a row', sentence: true },
  // 不 and 一
  { id: 'bushi', hanzi: '不是', pinyin: 'bú shì', english: 'is not', check: '不 before a 4th tone: bú' },
  { id: 'buhao', hanzi: '不好', pinyin: 'bù hǎo', english: 'not good', check: '不 stays bù' },
  { id: 'yige', hanzi: '一个', pinyin: 'yí ge', english: 'one, a', check: '一 → yí, 个 neutral' },
  { id: 'yiqi', hanzi: '一起', pinyin: 'yìqǐ', english: 'together', check: '一 → yì' },
  { id: 'diyi', hanzi: '第一', pinyin: 'dì yī', english: 'first', check: '一 stays yī' },
  // Neutral tones
  { id: 'mama', hanzi: '妈妈', pinyin: 'māma', english: 'mum', check: 'second ma light and short' },
  { id: 'xiexie', hanzi: '谢谢', pinyin: 'xièxie', english: 'thank you', check: 'second xie neutral' },
  { id: 'dongxi', hanzi: '东西', pinyin: 'dōngxi', english: 'thing, stuff', check: 'dōngxi (thing), not dōngxī (east and west)' },
  { id: 'pengyou', hanzi: '朋友', pinyin: 'péngyou', english: 'friend', check: 'you neutral' },
  { id: 'piaoliang', hanzi: '漂亮', pinyin: 'piàoliang', english: 'pretty', check: 'liang neutral' },
  { id: 'shenme', hanzi: '什么', pinyin: 'shénme', english: 'what', check: 'me neutral' },
  // 儿化 (Beijing)
  { id: 'nar', hanzi: '哪儿', pinyin: 'nǎr', english: 'where', check: 'one syllable nǎr, not nǎ ér' },
  { id: 'yidianr', hanzi: '一点儿', pinyin: 'yìdiǎnr', english: 'a little', check: 'diǎnr with the r' },
  { id: 'wanr', hanzi: '玩儿', pinyin: 'wánr', english: 'to play', check: 'wánr' },
  // Polyphones
  { id: 'yinhang', hanzi: '银行', pinyin: 'yínháng', english: 'bank', check: '行 = háng' },
  { id: 'buxing', hanzi: '不行', pinyin: 'bù xíng', english: "won't do", check: '行 = xíng' },
  { id: 'changcheng', hanzi: '长城', pinyin: 'Chángchéng', english: 'the Great Wall', check: '长 = cháng' },
  { id: 'zhangda', hanzi: '长大', pinyin: 'zhǎngdà', english: 'to grow up', check: '长 = zhǎng' },
  { id: 'liaojie', hanzi: '了解', pinyin: 'liǎojiě', english: 'to understand', check: '了 = liǎo' },
  { id: 'deizou', hanzi: '我得走了。', pinyin: 'Wǒ děi zǒu le.', english: 'I have to go.', check: '得 = děi, 了 = le', sentence: true },
  { id: 'haishu', hanzi: '还书', pinyin: 'huán shū', english: 'to return a book', check: '还 = huán (not hái)' },
  { id: 'haiyou', hanzi: '还有', pinyin: 'hái yǒu', english: 'there is still', check: '还 = hái' },
  // Minimal tone pairs
  { id: 'mai3', hanzi: '买', pinyin: 'mǎi', english: 'to buy', check: '3rd tone, dips' },
  { id: 'mai4', hanzi: '卖', pinyin: 'mài', english: 'to sell', check: '4th tone, falls' },
  // Everyday sentences
  { id: 'mingtian', hanzi: '你明天有空吗？', pinyin: 'Nǐ míngtiān yǒu kòng ma?', english: 'Are you free tomorrow?', check: 'natural question intonation, tones still clear', sentence: true },
  { id: 'juede', hanzi: '我觉得这个很好吃。', pinyin: 'Wǒ juéde zhège hěn hǎochī.', english: 'I think this is delicious.', check: 'juéde, hěn hǎochī (3+3)', sentence: true },
];
