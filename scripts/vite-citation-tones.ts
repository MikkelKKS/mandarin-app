/**
 * Vite plugin: provides `virtual:citation-tones`, a map from every Chinese
 * character used in /content to its dictionary (citation) tones. Computed at
 * build time with pinyin-pro so the large dictionary isn't shipped to the app.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinyin } from 'pinyin-pro';
import type { Plugin } from 'vite';

const ID = 'virtual:citation-tones';
const RESOLVED = '\0' + ID;

export function citationTones(root: string): Plugin {
  return {
    name: 'citation-tones',
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const dir = join(root, 'content');
      const files = [...readdirSync(join(dir, 'units')).map((f) => join(dir, 'units', f)), join(dir, 'sounds.json')];
      const chars = new Set<string>();
      for (const f of files) {
        this.addWatchFile(f);
        for (const ch of readFileSync(f, 'utf8')) if (/\p{Script=Han}/u.test(ch)) chars.add(ch);
      }
      const map: Record<string, number[]> = {};
      for (const ch of chars) {
        const r = pinyin(ch, { toneType: 'num', type: 'array', toneSandhi: false }) as string[];
        map[ch] = r.map((x) => Number(x.slice(-1))).filter((n) => n >= 1 && n <= 4);
      }
      return `export default ${JSON.stringify(map)};`;
    },
  };
}
