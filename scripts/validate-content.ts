/**
 * Validates everything in /content: schemas, cross-references, pinyin vs
 * characters, and that audio exists. Exit code 1 on errors.
 * Usage: npm run content:validate [-- --allow-missing-audio]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkContent } from '../src/content/check';
import { checkStory } from '../src/content/stories';

const root = join(import.meta.dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const allowMissingAudio = process.argv.includes('--allow-missing-audio');

const unitFiles = readdirSync(join(root, 'content/units')).filter((f) => f.endsWith('.json')).sort();
const report = checkContent(
  read('content/course.json'),
  unitFiles.map((f) => ({ file: `units/${f}`, data: read(`content/units/${f}`) })),
  read('content/sounds.json'),
  (rel) => existsSync(join(root, 'public', rel)),
  hskIndex(),
);

function hskIndex(): Map<string, number> | undefined {
  const p = 'content/hsk/hsk-levels.json';
  if (!existsSync(join(root, p))) return undefined;
  const data = read(p) as { words: Array<{ h: string; l: number }> };
  const m = new Map<string, number>();
  for (const w of data.words) if (!m.has(w.h)) m.set(w.h, w.l);
  return m;
}

// Reading stories: every character must be taught by the unit the story follows.
const storyDir = join(root, 'content/stories');
const storyFiles = existsSync(storyDir) ? readdirSync(storyDir).filter((f) => f.endsWith('.json')).sort() : [];
const unitData = unitFiles.map((f) => read(`content/units/${f}`));
for (const f of storyFiles) report.errors.push(...checkStory(`stories/${f}`, read(`content/stories/${f}`), unitData));

let errors = report.errors;
if (allowMissingAudio) {
  const audio = errors.filter((e) => e.includes('audio file(s) missing'));
  audio.forEach((e) => console.warn(`warning: ${e}`));
  errors = errors.filter((e) => !audio.includes(e));
}
report.warnings.forEach((w) => console.warn(`warning: ${w}`));
errors.forEach((e) => console.error(`error: ${e}`));
console.log(`${unitFiles.length} unit file(s) and ${storyFiles.length} story file(s) checked: ${errors.length} error(s), ${report.warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
