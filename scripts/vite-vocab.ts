/**
 * Vite plugin for the big HSK 3.0 word list (content/data/words.json):
 * - `virtual:vocab-legacy`: old course word id → new word id. Small; bundled with the app.
 * - `virtual:vocab`: a slim copy of every word (id, characters, pinyin, glosses, level,
 *   order, examples), loaded on demand with `import()` so it's its own cached chunk.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const LEGACY = 'virtual:vocab-legacy';
const VOCAB = 'virtual:vocab';

interface RawWord {
  id: string;
  hanzi: string;
  pinyin: string;
  level: number;
  order: number;
  gloss: string[];
  examples: string[];
  legacy?: string[];
}

export function vocabModules(root: string): Plugin {
  const file = join(root, 'content', 'data', 'words.json');
  const read = (): RawWord[] => {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : raw.words;
  };
  return {
    name: 'vocab-modules',
    resolveId: (id) => (id === LEGACY || id === VOCAB ? '\0' + id : undefined),
    load(id) {
      if (id !== '\0' + LEGACY && id !== '\0' + VOCAB) return;
      this.addWatchFile(file);
      const words = read();
      if (id === '\0' + LEGACY) {
        const map: Record<string, string> = {};
        for (const w of words) for (const l of w.legacy ?? []) map[l] = w.id;
        return `export default ${JSON.stringify(map)};`;
      }
      // Tuples keep the chunk small: [id, hanzi, pinyin, glosses, level, order, examples]
      const rows = words.map((w) => [w.id, w.hanzi, w.pinyin, w.gloss.slice(0, 3), w.level, w.order, w.examples]);
      return `export default ${JSON.stringify(rows)};`;
    },
  };
}
