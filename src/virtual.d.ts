declare module 'virtual:citation-tones' {
  const map: Record<string, number[]>;
  export default map;
}
declare module 'virtual:vocab-legacy' {
  /** Old course word id → HSK 3.0 word id. */
  const map: Record<string, string>;
  export default map;
}
declare module 'virtual:vocab' {
  /** [id, hanzi, pinyin, glosses, level, order, example sentence ids, 1 if an Azure recording exists, old course id or ''] */
  const rows: Array<[string, string, string, string[], number, number, string[], number, string]>;
  export default rows;
}
declare module 'virtual:sentences' {
  /** [id, hanzi, pinyin, english (up to 2), word ids, 1 if an Azure recording exists, 1 if from the course] */
  const rows: Array<[string, string, string, string[], string[], number, number]>;
  export default rows;
}
