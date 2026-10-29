/**
 * Builds the Music song catalogue: content/data/songs.json.
 *
 * Lyrics first: artists come from MusicBrainz (tags like mandopop, chinese rock,
 * chinese indie; CC0 data) plus the app's scene artists; their songs come from
 * LRCLIB (free, open lyrics database). Only Mandarin (not Cantonese) songs with
 * lyrics are kept, synced lyrics preferred. For each song only DERIVED data is
 * stored: LRCLIB id, title, artist, duration, synced, scene, other spellings,
 * which HSK words occur (with counts, for the "you know X%" share), the number of
 * other words, and a level profile. The lyrics themselves are never written anywhere.
 *
 * Runs weekly in GitHub Actions (.github/workflows/songs.yml), or:
 *   npm run dict:build && npx tsx scripts/build-songs.ts [--max-artists 300]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDict, segment } from '../src/features/dictionary/dict';
import type { Catalogue, CatalogueSong } from '../src/features/music/catalogue';
import { SCENES } from '../src/features/music/genres';
import { getJson, lyricsOf, nameKey, sameName, toSimplified, withRetry, type LrcRecord } from '../src/features/music/match';
import { isChineseLyrics } from '../src/features/music/score';
import { isHanzi } from '../src/lib/pinyin';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'mandarin-app/1.0 (personal learning app; https://github.com/MikkelKKS/mandarin-app)';
const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const MAX_ARTISTS = Number(arg('max-artists', '320'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** MusicBrainz tags → the app's scenes. */
const TAGS: Array<[string, string]> = [
  ['mandopop', 'pop'],
  ['c-pop', 'pop'],
  ['cpop', 'pop'],
  ['chinese pop', 'pop'],
  ['taiwanese pop', 'pop'],
  ['chinese ballad', 'ballad'],
  ['chinese rock', 'rock'],
  ['taiwanese rock', 'rock'],
  ['chinese indie', 'indie'],
  ['taiwanese indie', 'indie'],
  ['chinese folk', 'folk'],
  ['chinese hip hop', 'hiphop'],
  ['chinese rap', 'hiphop'],
  ['chinese r&b', 'rnb'],
];
/** Searches for children's songs (no artist list). */
const KIDS = ['儿歌', '中文儿歌', '儿童歌曲', '童谣', '幼儿歌曲', '宝宝巴士'];
const FILLERS = new Set(['啊', '呀', '哦', '喔', '哎', '嗯', '啦', '吧', '呢', '嘛', '哈', '噢', '呵', '哟', '唉', '耶', '咿', '哇', '嘿', '喂', '诶', '哼', '呜']);
const CANTONESE = /[嘅咗唔係佢冇啲嘢咁喺哋嚟乜]/g;
const HAN = /\p{Script=Han}/u;

interface Artist {
  names: string[];
  scene: string;
  source: string;
}

interface MbArtist {
  name: string;
  'sort-name'?: string;
  score?: number;
  country?: string;
  aliases?: Array<{ name: string; locale?: string | null }>;
  tags?: Array<{ name: string; count: number }>;
}

async function musicBrainz(tag: string, offset: number): Promise<MbArtist[]> {
  const url = `https://musicbrainz.org/ws/2/artist?${new URLSearchParams({ query: `tag:"${tag}"`, limit: '100', offset: String(offset), fmt: 'json' })}`;
  const j = await withRetry(() => getJson<{ artists: MbArtist[] }>(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }));
  await sleep(1100); // MusicBrainz asks for at most one request a second
  return j?.artists ?? [];
}

async function lrclib(q: string): Promise<LrcRecord[]> {
  const url = `https://lrclib.net/api/search?${new URLSearchParams({ q })}`;
  const r = await withRetry(() => getJson<LrcRecord[]>(url, { headers: { 'User-Agent': UA } }), { tries: 5, baseMs: 1000 });
  await sleep(250);
  return r ?? [];
}

/** Artists: the app's scene artists, then MusicBrainz artists by tag (Chinese and romanised names). */
async function findArtists(): Promise<Artist[]> {
  const out: Artist[] = [];
  const seen = new Set<string>();
  const add = (names: string[], scene: string, source: string) => {
    const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const keys = uniq.map((n) => nameKey(n));
    if (!uniq.length || keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    // Chinese names first: LRCLIB mostly files Mandarin songs under them.
    uniq.sort((a, b) => Number(HAN.test(b)) - Number(HAN.test(a)));
    out.push({ names: uniq.slice(0, 3), scene, source });
  };
  for (const s of SCENES) for (const a of s.artists) add([a], s.id, 'scene');
  for (const [tag, scene] of TAGS) {
    for (const offset of [0, 100, 200]) {
      let batch: MbArtist[] = [];
      try {
        batch = await musicBrainz(tag, offset);
      } catch (e) {
        console.warn(`MusicBrainz ${tag}: ${(e as Error).message}`);
      }
      for (const a of batch) {
        const tags = (a.tags ?? []).map((t) => t.name.toLowerCase());
        if (tags.some((t) => t.includes('cantopop') || t === 'cantonese')) continue;
        if ((a.score ?? 100) < 60) continue;
        const names = [a.name, ...(a.aliases ?? []).filter((x) => !x.locale || /^(zh|en)/.test(x.locale)).map((x) => x.name)];
        if (!names.some((n) => HAN.test(n)) && !['CN', 'TW', 'SG', 'MY'].includes(a.country ?? '')) continue;
        add(names, scene, `musicbrainz:${tag}`);
      }
      if (batch.length < 100) break;
    }
  }
  return out.slice(0, MAX_ARTISTS);
}

function main() {
  return run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

async function run() {
  const words = JSON.parse(readFileSync(join(root, 'content', 'data', 'words.json'), 'utf8')) as Array<{ id: string; hanzi: string; level: number; order: number }>;
  const dictText = readFileSync(join(root, 'public', 'dict', 'cedict.tsv'), 'utf8');
  const t2s = JSON.parse(readFileSync(join(root, 'public', 'dict', 't2s.json'), 'utf8')) as Record<string, string>;
  const dict = parseDict(dictText);
  if (dict.entries.length < 50000) throw new Error('The dictionary is missing: run npm run dict:build first.');
  const byHanzi = new Map<string, { id: string; level: number }>();
  for (const w of [...words].sort((a, b) => a.order - b.order)) if (!byHanzi.has(w.hanzi)) byHanzi.set(w.hanzi, { id: w.id, level: w.level });
  const levelOf = new Map(words.map((w) => [w.id, w.level]));

  const artists = await findArtists();
  console.log(`${artists.length} artists (${artists.filter((a) => a.source === 'scene').length} from the app's scenes)`);

  /** Best record per song, and the other spellings of it. */
  const songs = new Map<string, { rec: LrcRecord; scene: string; alt: Map<string, [string, string]> }>();
  const consider = (r: LrcRecord, scene: string, artist?: Artist) => {
    if (r.instrumental || (!r.syncedLyrics && !r.plainLyrics) || !r.duration) return;
    if (artist && !artist.names.some((n) => sameName(r.artistName, n, t2s))) return;
    const key = `${nameKey(r.trackName, t2s)}|${artist ? nameKey(artist.names[0], t2s) : nameKey(r.artistName, t2s)}`;
    const cur = songs.get(key);
    const better = !cur || (!!r.syncedLyrics && !cur.rec.syncedLyrics) || (!!r.syncedLyrics === !!cur.rec.syncedLyrics && (r.syncedLyrics ?? r.plainLyrics ?? '').length > (cur.rec.syncedLyrics ?? cur.rec.plainLyrics ?? '').length);
    const alt = cur?.alt ?? new Map<string, [string, string]>();
    alt.set(`${r.trackName}|${r.artistName}`, [r.trackName, r.artistName]);
    if (artist) for (const n of artist.names) if (!HAN.test(n)) alt.set(`${r.trackName}|${n}`, [r.trackName, n]);
    songs.set(key, { rec: better ? r : cur!.rec, scene: cur?.scene ?? scene, alt });
  };

  let queries = 0;
  for (const [i, a] of artists.entries()) {
    for (const name of a.names) {
      try {
        for (const r of await lrclib(name)) consider(r, a.scene, a);
        queries++;
      } catch (e) {
        console.warn(`LRCLIB "${name}": ${(e as Error).message}`);
      }
    }
    if (i % 25 === 0) console.log(`${i + 1}/${artists.length} artists, ${songs.size} songs so far`);
  }
  for (const q of KIDS) {
    try {
      for (const r of await lrclib(q)) consider(r, 'easy');
      queries++;
    } catch (e) {
      console.warn(`LRCLIB "${q}": ${(e as Error).message}`);
    }
  }

  // Derived data only: which HSK words occur and how often, other words, fillers, a level profile.
  const wordIndex = new Map<string, number>();
  const wordList: string[] = [];
  const out: CatalogueSong[] = [];
  const dropped = { english: 0, cantonese: 0, short: 0 };
  for (const { rec, scene, alt } of songs.values()) {
    const ly = lyricsOf(rec);
    const lines = ly?.lines.map((l) => l.text).filter(Boolean) ?? [];
    if (!lines.length || !isChineseLyrics(lines)) {
      dropped.english++;
      continue;
    }
    const text = lines.join('\n');
    if ((text.match(CANTONESE) ?? []).length >= 3) {
      dropped.cantonese++;
      continue;
    }
    const counts = new Map<string, number>();
    const distinct = new Set<string>();
    let other = 0;
    let fillers = 0;
    for (const line of lines)
      for (const tok of segment(dict, toSimplified(line, t2s))) {
        if (![...tok.text].some(isHanzi)) continue;
        distinct.add(tok.text);
        if (FILLERS.has(tok.text) || [...tok.text].every((c) => FILLERS.has(c))) fillers++;
        else {
          const w = byHanzi.get(tok.text);
          if (w) counts.set(w.id, (counts.get(w.id) ?? 0) + 1);
          else other++;
        }
      }
    const tokens = fillers + other + [...counts.values()].reduce((a, b) => a + b, 0);
    if (tokens < 30) {
      dropped.short++;
      continue;
    }
    const lv = [0, 0, 0, 0, 0, 0, 0];
    for (const id of counts.keys()) {
      const level = levelOf.get(id) ?? 0;
      if (level >= 1) lv[Math.min(level, 7) - 1]++;
    }
    // Word ids sorted, so nothing about the order of the lyrics is kept.
    const w = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, n]) => {
        let i = wordIndex.get(id);
        if (i === undefined) {
          i = wordList.length;
          wordList.push(id);
          wordIndex.set(id, i);
        }
        return `${i}:${n}`;
      })
      .join(',');
    const alts = [...alt.values()].filter(([t, a]) => t !== rec.trackName || a !== rec.artistName).slice(0, 4);
    out.push({
      id: rec.id,
      title: rec.trackName,
      artist: rec.artistName,
      dur: Math.round(rec.duration),
      synced: !!rec.syncedLyrics,
      scene,
      ...(alts.length && { alt: alts }),
      w,
      o: other,
      f: fillers,
      d: distinct.size,
      lv,
    });
  }
  out.sort((a, b) => a.scene.localeCompare(b.scene) || a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  const cat: Catalogue & { _about: string } = {
    _about:
      'Mandarin songs with lyrics on LRCLIB (https://lrclib.net), built by scripts/build-songs.ts. Derived data only: LRCLIB id, title, artist, duration, synced, scene, other spellings, HSK word counts ("index:count" into words), other and filler token counts, distinct words, distinct HSK words per level. No lyrics are stored.',
    generated: new Date().toISOString().slice(0, 10),
    words: wordList,
    songs: out,
  };
  writeFileSync(join(root, 'content', 'data', 'songs.json'), JSON.stringify(cat) + '\n');

  const byScene = new Map<string, number>();
  for (const s of out) byScene.set(s.scene, (byScene.get(s.scene) ?? 0) + 1);
  const report = [
    '# Song catalogue',
    '',
    `Built ${cat.generated} by scripts/build-songs.ts: ${out.length} songs (${out.filter((s) => s.synced).length} with timed lyrics) from ${artists.length} artists, ${queries} LRCLIB searches.`,
    '',
    `Left out: ${dropped.english} not mostly Chinese, ${dropped.cantonese} Cantonese, ${dropped.short} too short.`,
    '',
    '| Scene | Songs |',
    '|---|---|',
    ...SCENES.map((s) => `| ${s.label} | ${byScene.get(s.id) ?? 0} |`),
    '',
    '## Artists',
    '',
    ...artists.map((a) => `- ${a.names.join(' / ')} (${a.scene}, ${a.source}): ${out.filter((s) => a.names.some((n) => sameName(s.artist, n, t2s))).length} songs`),
    '',
  ].join('\n');
  writeFileSync(join(root, 'content', 'data', 'SONGS_REPORT.md'), report);
  console.log(`${out.length} songs written (${JSON.stringify(dropped)} left out)`);
}

void main();
