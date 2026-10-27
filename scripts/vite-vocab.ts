/**
 * Vite plugin for the big HSK 3.0 word list (content/data/words.json):
 * - `virtual:vocab-legacy`: old course word id → new word id. Small; bundled with the app.
 * - `virtual:vocab`: a slim copy of every word (id, characters, pinyin, glosses, level,
 *   order, examples, which recordings exist, old course id), loaded on demand with
 *   `import()` so it's its own cached chunk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const LEGACY = 'virtual:vocab-legacy';
const VOCAB = 'virtual:vocab';
/** Example sentences: [id, hanzi, pinyin, english, word ids, 1 if an Azure recording exists, source]. */
const SENTENCES = 'virtual:sentences';

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
    resolveId: (id) => (id === LEGACY || id === VOCAB || id === SENTENCES ? '\0' + id : undefined),
    load(id) {
      if (id === '\0' + SENTENCES) {
        const file = join(root, 'content', 'data', 'sentences.json');
        this.addWatchFile(file);
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        const list: Array<{ id: string; hanzi: string; pinyin: string; english: string[]; words: string[]; source: string }> = Array.isArray(raw) ? raw : raw.sentences;
        const manifestFile = join(root, 'content', 'data', 'azure-audio.json');
        const made: Record<string, string> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
        const rows = list.map((x) => [x.id, x.hanzi, x.pinyin, x.english.slice(0, 2), x.words, made[`${x.id}.mp3`] ? 1 : 0, x.source === 'course' ? 1 : 0]);
        return `export default ${JSON.stringify(rows)};`;
      }
      if (id !== '\0' + LEGACY && id !== '\0' + VOCAB) return;
      this.addWatchFile(file);
      const words = read();
      if (id === '\0' + LEGACY) {
        const map: Record<string, string> = {};
        for (const w of words) for (const l of w.legacy ?? []) map[l] = w.id;
        return `export default ${JSON.stringify(map)};`;
      }
      // Which Azure recordings exist (the bulk job commits them, and every commit redeploys).
      const manifestFile = join(root, 'content', 'data', 'azure-audio.json');
      if (existsSync(manifestFile)) this.addWatchFile(manifestFile);
      const made: Record<string, string> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
      // Tuples keep the chunk small: [id, hanzi, pinyin, glosses, level, order, examples, audio, course id]
      // audio: 1 = Azure recording exists.
      const rows = words.map((w) => [
        w.id,
        w.hanzi,
        w.pinyin,
        w.gloss.slice(0, 3),
        w.level,
        w.order,
        w.examples,
        made[`${w.id}.mp3`] ? 1 : 0,
        w.legacy?.[0] ?? '',
      ]);
      return `export default ${JSON.stringify(rows)};`;
    },
  };
}
