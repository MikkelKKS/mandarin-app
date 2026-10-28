# Architecture

How the app is built, as of the clean-up on 28 Oct 2026. The product brief is `CLAUDE.md`; dated decisions are in `DECISIONS.md`.

## Stack

Vite 7, React 19, TypeScript (strict), Tailwind v4 and `vite-plugin-pwa`, deployed to GitHub Pages from `main` (`.github/workflows/deploy.yml`, which runs the unit and browser tests first). Hash routing (`src/lib/router.ts`). Local data in IndexedDB through Dexie (`src/db/db.ts`), synced to Supabase.

## Screens

Five tabs (`src/App.tsx`): **Home**, **Tones**, **Library**, **Stats**, **Settings**.

| Screen | Where | What it does |
|---|---|---|
| Home | `features/home/` | Goal ring, streak, level; Quick or Deep session; resume; Tone Gym; placement; next achievement |
| Session | `features/session/` | `plan.ts` builds the blocks (reviews → new words → listening → say it in pinyin → speaking → tones); `SessionPlayer.tsx` runs them; `items.tsx` has each question type; `Speak.tsx` the pitch comparison |
| Tone Gym | `features/tonegym/` | Rounds of 20 from Tone Perfect recordings: Workout (adaptive, `model.ts`) or Even mix; confusion matrix |
| Library | `features/library/` | Links to Conversations, Stories, Music, HSK words, Dictionary |
| Conversations | `features/path/`, `features/lesson/`, `features/exercises/`, `features/story/` | The 29 hand-written units: lessons, listening stories and role-play. No locks |
| Stories | `features/read/` | Eight short stories, read aloud paragraph by paragraph |
| Music | `features/music/` | Spotify songs scored against what you know; lyrics with pinyin |
| HSK words | `features/progress/WordsView.tsx` | Every word by level and stage; move words between stages |
| Dictionary | `features/dictionary/` | CC-CEDICT lookup, sentence breakdown, translation, "Learn next" |
| Stats | `features/stats/` | Words by level and stage, retention, forecast, tones, time, accuracy, XP, achievements |
| Placement | `features/placement/` | A short test (dictation, then the meaning) or a chosen starting level marks known words |
| Settings | `features/settings/` | Learning, display, microphone, sync and backup, recordings |

Shared pieces: `components/PageHeader.tsx`, `ProgressBar.tsx`, `WordPopover.tsx`, `LearnNext.tsx`, `GrammarNote.tsx`, `VolumeSlider.tsx`, `icons.tsx`. Design tokens, the `card` / `group-list` / `btn` classes and all animations are in `src/index.css`.

## Learning data: one picture of what you know

- **Words** are the HSK 3.0 list (`content/data/words.json`, built by `scripts/build-vocab.ts`), loaded as a lazy chunk (`lib/vocabData.ts`). The Conversations units have their own word ids (`w-…`); `virtual:vocab-legacy` maps each one to its HSK word.
- **Cards** (`reviewItems`): one per word and skill, `<word>#lm|lp|mp|sp` (listening → meaning, listening → pinyin, meaning → pinyin, speaking), plus one per sentence. Scheduled with `ts-fsrs` (`lib/review.ts`). Every answer appends a full entry to `reviewLogs` (append-only).
- **Word stage** (new / learning / young / mature) comes from a word's listening and typing cards (`wordState` in `lib/review.ts`). `lib/knowledge.ts` turns the cards into the stage of every word, and every screen reads it from there: sessions, Stats, the word list, Conversations (lessons count as done when you know their words), Stories ("you know 72% of the words") and Music.
- **Meanings:** exercises show a short learner meaning (`meaningOf` in `lib/vocabData.ts`): hand-written for HSK 1–4 in `content/data/short-glosses.json`, otherwise a trimmed CC-CEDICT gloss. Word cards and the dictionary show the full CC-CEDICT text. `lib/gloss.ts` compares meanings (shared terms, same pinyin) so wrong options are never synonyms or homophones.
- **Example sentences:** Tatoeba first; HSK 1–4 words without one have a sentence written for the app (`content/generated-sentences.json`, marked generated, listed in `content/REVIEW_NEEDED.md`).
- **Words in context** (`lib/context.ts`): homophones and neutral-tone particles among HSK 1–4 are heard and dictated inside their example sentence, with the word marked or blanked.
- **Grammar notes** (`content/grammar-notes.json`, `lib/grammar.ts`): 50 function words, shown on the intro and behind "Grammar" buttons; their examples are recorded with Azure.
- Answers in a Conversations lesson update the same HSK word cards (`lib/srs.ts`), and lessons skip introducing words you've already met.
- **Gamification** (`lib/gamify.ts`, `lib/gameStats.ts`): XP is stored on each log entry, so it syncs with the log. Streaks, freezes and levels are computed from the log; achievements are kept as `ach:<id>` rows in `gameScores`.

## Pinyin

`lib/pinyin.ts` parses and segments; `lib/pinyinAnswer.ts` scores syllables and tones separately (strict or lenient); `lib/pinyinLive.ts` turns tone numbers into marks as you type.

## Audio

- **Azure Speech** (Free F0, `swedencentral`): `scripts/azure-tts.ts`, run by `.github/workflows/azure-audio.yml` every 6 hours. It counts billed characters, stops before the monthly free quota and carries on the next month. Output in `public/audio/az/`, with a manifest in `content/data/azure-audio.json`. It records words, sentences (including generated ones), grammar-note examples, story paragraphs and 0.7× sentence versions. Keys are GitHub secrets.
- **Tone Perfect** (MSU Libraries, CC BY-NC 4.0): 410 syllables × 4 tones × 6 speakers, converted to 40 kbps mono by `scripts/tone-perfect.ts` into `public/audio/tp/`, indexed in `content/data/tone-perfect.json`. Levelled to −20 LUFS. The Tone Gym uses only these recordings (single tones), and so do the tone questions in sessions.
- **Report bad audio** → Supabase `audio_reports` → the next run re-records the clip with full pronunciation hints (a second report switches voice).
- Playback (`lib/audio.ts`): Azure first, then the older edge-tts recordings (`public/audio/f|m|dict`) while Azure isn't complete, and the browser voice only as a last resort, flagged on screen.
- One volume level for all recordings (`audio:volume` in local storage, per device), set by the slider under each player or in Settings.
- The service worker caches audio as it's played; sessions download their audio when they start, and cards due in the next two days are fetched in the background.

## Sync

`src/sync/`: magic-link sign-in; each record is one JSON row in Supabase with row-level security (`supabase/migrations/`). Last write wins per row, review logs are append-only, lesson progress takes the max. Synced tables: progress, reviewItems, reviewLogs, settings, gameScores, audioReports.

## Translation

`supabase/functions/translate`: a small Supabase function that calls Azure Translator (free F0) with a key kept as a Supabase secret, and only answers the app's owner. It's deployed by `.github/workflows/translate-function.yml`. Until it's set up, the dictionary uses the free MyMemory service (`features/dictionary/translate.ts`).

## Tests

Vitest for the pure logic (scoring, scheduling, knowledge, planning, placement, pitch tracking, content checks), Playwright for the main flows on phone and desktop sizes (`e2e/`). Both run before every deploy.

## Still open

- November's Azure quota: slow (0.7×) sentences, generated example sentences, grammar examples and story paragraphs.
- Checking the generated sentences in `content/REVIEW_NEEDED.md`.
- Once Azure has every word and sentence, the older recordings in `public/audio/f`, `m` and `dict` can be deleted (about 170 MB).
- The scheduler optimiser, once there are about 1,000 reviews.
