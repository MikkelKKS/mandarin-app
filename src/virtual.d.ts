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
  /** [id, hanzi, pinyin, glosses, level, order, example sentence ids] */
  const rows: Array<[string, string, string, string[], number, number, string[]]>;
  export default rows;
}
