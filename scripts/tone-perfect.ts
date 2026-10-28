/**
 * Tone Perfect (Michigan State University Libraries, CC BY-NC 4.0): 410 Mandarin
 * syllables × 4 tones by 6 native speakers (3 female, 3 male), recorded by
 * people. Converts the downloaded MP3s (44.1 kHz stereo, ~280 MB) to 40 kbps
 * mono (~60 MB) in public/audio/tp/<syllable><tone>_<f|m><n>.mp3 and writes the
 * index content/data/tone-perfect.json. Idempotent: existing files are kept.
 *
 *   npx tsx scripts/tone-perfect.ts <folder with ma1_FV1_MP3.mp3 …>
 *
 * Needs ffmpeg. Source: https://listings.lib.msu.edu/toneperfect/
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'audio', 'tp');
const NAME = /^([a-z]+)([1-4])_([FM])V([1-3])_MP3\.mp3$/;

const src = process.argv[2];
mkdirSync(OUT, { recursive: true });
if (src) {
  let made = 0;
  for (const f of readdirSync(src)) {
    const m = NAME.exec(f);
    if (!m) continue;
    const out = join(OUT, `${m[1]}${m[2]}_${m[3].toLowerCase()}${m[4]}.mp3`);
    if (existsSync(out)) continue;
    execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', join(src, f), '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out]);
    made++;
  }
  console.log(`Converted ${made} file(s).`);
}

// Index: syllable → tone → speakers that have it.
const index: Record<string, Record<string, string[]>> = {};
for (const f of readdirSync(OUT).sort()) {
  const m = /^([a-z]+)([1-4])_([fm][1-3])\.mp3$/.exec(f);
  if (!m) continue;
  ((index[m[1]] ??= {})[m[2]] ??= []).push(m[3]);
}
writeFileSync(join(ROOT, 'content', 'data', 'tone-perfect.json'), JSON.stringify(index) + '\n');
const n = Object.values(index).reduce((a, t) => a + Object.values(t).reduce((b, s) => b + s.length, 0), 0);
console.log(`Index: ${Object.keys(index).length} syllables, ${n} recordings.`);
