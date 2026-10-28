/**
 * Tone Perfect (Michigan State University Libraries, CC BY-NC 4.0): 410 Mandarin
 * syllables × 4 tones by 6 native speakers (3 female, 3 male), recorded by
 * people. Converts the downloaded MP3s (44.1 kHz stereo, ~280 MB) to 40 kbps
 * mono (~60 MB) in public/audio/tp/<syllable><tone>_<f|m><n>.mp3 and writes the
 * index content/data/tone-perfect.json. The originals are mastered very loud
 * (about −7 LUFS, peaks above full scale), so each clip is turned down to the
 * loudness of the Azure recordings (−20 LUFS) with at least 2 dB of headroom.
 * Idempotent: existing files are kept (--force remakes them).
 *
 *   npx tsx scripts/tone-perfect.ts <folder with ma1_FV1_MP3.mp3 …> [--force]
 *
 * Needs ffmpeg. Source: https://listings.lib.msu.edu/toneperfect/
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'audio', 'tp');
const NAME = /^([a-z]+)([1-4])_([FM])V([1-3])_MP3\.mp3$/;

const run = promisify(execFile);
const TARGET_LUFS = -20;
const MAX_PEAK = -2;

/** Integrated loudness and true peak of a file, from ffmpeg's EBU R128 meter. */
async function measure(file: string): Promise<{ lufs: number; peak: number }> {
  const { stderr } = await run('ffmpeg', ['-nostdin', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1] ?? TARGET_LUFS);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1] ?? 0);
  return { lufs, peak };
}

async function convert(input: string, out: string): Promise<void> {
  const { lufs, peak } = await measure(input);
  // Down to the target loudness, and never closer than MAX_PEAK to full scale.
  const gain = Math.min(TARGET_LUFS - lufs, MAX_PEAK - peak);
  await run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', input, '-af', `volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out]);
}

const src = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const force = process.argv.includes('--force');
mkdirSync(OUT, { recursive: true });
if (src) {
  const jobs = readdirSync(src)
    .map((f) => ({ f, m: NAME.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => !!x.m)
    .map(({ f, m }) => ({ input: join(src, f), out: join(OUT, `${m[1]}${m[2]}_${m[3].toLowerCase()}${m[4]}.mp3`) }))
    .filter((j) => force || !existsSync(j.out));
  let next = 0;
  let made = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        await convert(j.input, j.out);
        if (++made % 1000 === 0) console.log(`${made} / ${jobs.length}`);
      }
    }),
  );
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
