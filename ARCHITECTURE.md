# Architecture

What the app is today, and what the redesign in `CLAUDE.md` keeps, changes or removes. The old brief is kept as `CLAUDE-old.md` for reference.

## What exists today

About 11,600 lines of TypeScript, deployed to GitHub Pages from `main` by GitHub Actions.

| Area | Where | State |
|---|---|---|
| App shell | Vite 7, React 19, TypeScript (strict), Tailwind v4, `vite-plugin-pwa` | Works offline, installable, hash routing (`src/lib/router.ts`) |
| Local data | Dexie (IndexedDB), `src/db/db.ts` | Tables: `progress`, `reviewItems`, `reviewLogs`, `settings`, `customPacks`, `gameScores`, `meta` |
| Sync | Supabase (magic-link login), `src/sync/`, `supabase/migrations/001_init.sql` | One JSON row per record with RLS. Last write wins; logs append-only; mastery takes the max. Tested |
| Scheduling | `ts-fsrs`, `src/lib/srs.ts` | **One card per word or sentence** (no facets). Desired retention is fixed |
| Pinyin checking | `src/lib/pinyin.ts`, `src/lib/pinyinAnswer.ts` | Tone marks or numbers, `v`/`u:`, neutral tone, sandhi leniency, typo pass, accepted variants (您/你, 一个 optional…). 190 lines of tests. Reports tones per syllable |
| Content | `content/units/*.json` (29 hand-written units), `content/stories/`, zod schemas in `src/content/` | 672 words (HSK 2.0 levels 1–3), 800 sentences, dialogues, grammar notes. Validated in CI |
| Audio | `scripts/generate-audio.py` (edge-tts, the unofficial free Microsoft voice) | 9,610 MP3s, 168 MB, in `public/audio`. Voices Xiaoxiao and Yunxi. About 120 still missing; the app then falls back to the other voice and finally to the browser's own voice |
| Dictionary | `scripts/build-dictionary.ts` → CC-CEDICT built in CI | Full lookup tab |
| Exercises | `src/features/exercises/` | Listening multiple choice, word tiles (drag and drop), dictation, English → pinyin, gap fill, tone ID, minimal pairs, character recognition, repeat-after-me with pitch chart (`pitchy`) |
| Path | `src/features/path/` | Units → skills → lessons, mastery rings, test-out |
| Games | `src/features/games/` | Tone Sort, Tone Pairs, Listening Blitz, Pair Rush, Sentence Scramble, Measure Words. Personal bests |
| Stories | `src/features/story/`, `src/features/read/` | Listening dialogues, role-play, a Read tab with personal stories |
| Progress | `src/features/progress/` | Words known per HSK level, review forecast, tone accuracy, missed words, activity |
| Extras | `src/features/music/`, `src/features/packs/` | Spotify songs at your level with synced lyrics and pinyin; import/export of practice packs made with Claude |
| Tests | Vitest (71 tests), Playwright (24 flows on phone and desktop) | Run in CI before every deploy |

Your progress lives in IndexedDB on each device and in Supabase. It is keyed by the current word ids (for example `w-ni`).

## The plan

### Keep (works and fits the new brief)
- The app shell, PWA setup, routing, deploy pipeline and test setup.
- Dexie plus Supabase sync, including login and backup. New tables get added to the same pattern.
- `ts-fsrs` and the review log. The log already stores tone data per answer, which the confusion matrix can use straight away.
- The pinyin parser and checker as the base for step 3. It gets extended, not rewritten.
- Pitch detection with `pitchy` as the base for the speaking step.
- CC-CEDICT, built by script in CI.

### Change
- **Vocabulary:** from 672 hand-picked HSK 2.0 words to the full HSK 3.0 list (about 11,000 terms) from `ivankra/hsk30` and `drkameleon/complete-hsk-vocabulary`, with CC-CEDICT glosses, sorted by frequency within each level. Output: one `words.json` and one `sentences.json` with stable ids.
- **Sentences:** Tatoeba pairs filtered to words you already know, with my own sentences where none exist (marked as generated). The 800 sentences already written can fill gaps.
- **Scheduling:** from one card per word to four facets per word (listening → meaning, listening → pinyin, meaning → pinyin, speaking), with Again/Hard/Good/Easy auto-grading, a retention setting, daily limits, and later an optimiser.
- **Existing progress:** migrated, not reset. Each current word card is copied onto the matching new word's facets, so words you know stay known.
- **Audio:** from edge-tts to Azure (Xiaoxiao + Yunjian), with SSML pronunciation hints, quota tracking and a "report bad audio" button. Plus Tone Perfect human recordings for Tone Gym. The browser voice stays only as a flagged last resort.
- **Tone colours:** today 3 is blue and 4 is purple. Change to the brief's scheme (1 red, 2 orange, 3 green, 4 blue, neutral grey) and make it configurable.
- **Hanzi:** off by default, an optional toggle. Pinyin everywhere. No answer ever needs characters.
- **Exercises:** typing first. Multiple choice only for a word's first exposure and in Tone Gym.
- **Speaking:** microphone on by default, with a global setting and a "no mic right now" toggle. Speaking cards are skipped (never failed) when it is off.
- **Home:** quick session (phone, about 5 min) and deep session (PC, 20+ min) instead of a path of units.
- **Motivation:** add XP, levels, daily goal, streak with streak freeze, achievements and a combo multiplier (the old brief forbade these).
- **Progress → Stats:** add retention vs target, a 14-day forecast, words by state per level, the tone confusion matrix, time per day and XP history.

### Remove or set aside
- **Character recognition exercises** (out of scope: pinyin only).
- **edge-tts generation** in CI. The existing edge-tts recordings stay until Azure audio replaces each one.

### Your decisions (27 Oct 2026)
- The 29 hand-written units (path, dialogues, role-play, stories) move to an optional **Conversations** section. The new sessions become the main way to study.
- **Music, Read, Games and Dictionary stay.** Games and Music will draw on the new word list.
- **Word tiles stay as an option** (a toggle), with typing as the default.
- **Old audio stays until replaced**, so no word loses its sound while Azure audio is generated.
- **Audio storage** gets decided at the audio step: the full set is roughly 500–700 MB even as Opus, close to the GitHub Pages limit of 1 GB per site.

## Progress through the build order
- Step 1 (this file) and step 2 (word list): done 27 Oct.
- Step 3 (pinyin input and scoring): done 27 Oct. `src/lib/pinyinAnswer.ts`, `src/lib/pinyinLive.ts`.
- Step 4 (review engine): done 27 Oct. `src/lib/review.ts` (facets, grading, queue, migration, log), `src/lib/srs.ts` (glue for lessons and games).
- Step 5 (audio): done 27 Oct. `scripts/azure-tts.ts`, `.github/workflows/azure-audio.yml`, report button.
- Step 6 (Tone Gym): done 27 Oct. `src/features/tonegym/`.
- Step 7 (sessions, XP): done 27 Oct. `src/features/home/`, `src/features/session/`, `src/lib/gamify.ts`, `src/lib/gameStats.ts`.
