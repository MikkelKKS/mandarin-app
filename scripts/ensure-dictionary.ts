/**
 * Makes sure the in-app dictionary (public/dict/cedict.tsv + t2s.json, git-ignored)
 * exists before a build, so a local build and the browser tests have the same
 * dictionary as the deployed app (IDEAS #19). Builds it only when missing: from
 * .vocab-sources/cedict.txt.gz if the vocabulary sources were downloaded, else
 * from MDBG. Offline, it warns and the build goes on without a dictionary.
 *
 *   npx tsx scripts/ensure-dictionary.ts
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDictionary } from './build-dictionary';

const root = join(import.meta.dirname, '..');
const has = (f: string) => existsSync(f) && statSync(f).size > 0;
const dict = join(root, 'public', 'dict');
if (!has(join(dict, 'cedict.tsv')) || !has(join(dict, 't2s.json'))) {
  const local = join(root, '.vocab-sources', 'cedict.txt.gz');
  console.log('Dictionary missing: building it once (CC-CEDICT)…');
  try {
    await buildDictionary(has(local) ? local : undefined);
  } catch (e) {
    console.warn(`Could not build the dictionary (${(e as Error).message}). The build continues; the Dictionary tab will be empty.`);
  }
}
