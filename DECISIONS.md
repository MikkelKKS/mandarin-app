# Decisions log

Choices made where CLAUDE.md was silent, plus notable incidents. Newest at the bottom.

## Setup
- **Hosting: GitHub Pages**, deployed by a GitHub Actions workflow on every push to `main`. The repo already exists, so no extra account; served over HTTPS, which PWAs need to be installable on Android and desktop.
- **Workflow: commit straight to `main`** (owner's choice).
- **Dependency snapshot workflow (`deps-snapshot.yml`).** The coding agent's sandbox cannot reach the npm registry, so CI installs dependencies and pushes a `node_modules` snapshot to the `deps-cache` branch, which the agent downloads to build and test locally. It does not affect the app.
- **Audio is generated in CI.** The sandbox also can't reach PyPI or the edge-tts service, so the deploy workflow runs `scripts/generate-audio.py` on GitHub's servers, only for missing files, and commits new MP3s back to the repo.

## Incident: blocked response (2026-10-11)
- **What happened:** a response was blocked by content filtering while I was about to write `src/lib/pinyin.ts` with the full table of ~400 standard pinyin syllables typed out from memory, which is an existing published list.
- **Fix:** following the new §4 rules, the list is never typed by hand. `scripts/build-syllables.ts` derives it from the open-source `pinyin-pro` package's dictionary (scanning every CJK character's readings) and writes `src/lib/syllables.generated.ts` (411 syllables). Re-run with `npm run syllables:build`.
- **Going forward:** vocabulary lists and dictionary data come from download scripts. Licences are referenced by name and link only. All sentences and dialogues are original. Content is written one unit per file per response.

## App design (phases 1–3)
- **Content layout:** one file per unit in `content/units/` holding that unit's words, sentences, exchanges, grammar notes, dialogue and skill nodes. The "vocabulary file" is the union of all unit files; the validator checks every reference across them. This keeps each content batch to one unit per file (CLAUDE.md §4).
- **HSK levels** are cross-checked against `content/hsk/hsk-levels.json`, produced by `scripts/fetch-hsk.ts` from an open MIT-licensed list. Words outside HSK 1–3 in that list (e.g. 你好 as a phrase, 中文, 丹麦) are marked level 0.
- **Lessons are generated** from a node's words/sentences/exchanges at play time (fresh mix every replay), following the 50/25/15/10 weighting. The schema still allows hand-written `lessons` per node if ever needed.
- **"What would you say?"** uses `exchanges` (prompt → good reply + wrong replies), so it gets its own content entity.
- **First 3 HSK 1 units** are Greetings & introductions, Family, and Food & drink. They were picked over Numbers & time because the goal is talking with a partner's family. Numbers 1–10 are covered in "Check your basics"; Numbers & time followed as unit 4.
- **Audio:** two voices (Xiaoxiao female, Yunxi male) for every word, sentence and drill syllable. Sentences also get a slow version (−25%, originally −35%). Words have no slow file and are played at 0.8× instead. Every clip is padded with silence to stop browsers cutting it off. Dialogues use each speaker's voice.
- **Erhua (儿) is avoided** in content for now (哪里 rather than 哪儿, 一点 rather than 一点儿), because syllable alignment assumes one character per syllable.
- **Mastery:** every completed lesson raises a node's mastery by 1 (max 5), whatever the accuracy. Wrong answers are re-queued within the lesson (up to twice) and come back in Practice. Test-outs need 80%.
- **Unlocking:** a node opens when the previous one is done, or when anything later in the path is done (after a test-out, skipped material stays open).
- **Answer grading for reviews:** correct/typo → FSRS Good, missing tones → Hard, wrong → Again. Only the first attempt per exercise is recorded.
- **Citation tones** for neutral-tone leniency are computed at build time (Vite plugin) so the ~300 KB pinyin dictionary isn't shipped to the browser.
- **Routing** uses URL hashes (`#/lesson/…`), so GitHub Pages never returns 404s on refresh.
- **Sound effects** are synthesised with the Web Audio API, so there are no audio assets to license.
- **Look:** jade green for progress and correct answers, cinnabar red for the seal-style app icon and wrong answers, gold for mastery rings. Characters and pinyin are coloured by tone (1 red, 2 orange, 3 blue, 4 purple, neutral grey), which can be switched off in Settings.

## Phases 4–8
- **Learner's Chinese name** ("Mi'ge") is written 米格 Mǐgé, flagged in REVIEW_NEEDED.md to confirm.
- **Audio regeneration:** `public/audio/manifest.json` records the text each file was made from, so edited sentences are re-recorded automatically. Audio URLs carry `?v=<hash of text>`, so the service-worker cache never serves stale audio.
- **Sync storage:** each Supabase table stores one JSON document per row (`data`), plus `updated_at` (the device's time) and `server_updated_at` (set by a trigger). Devices pull by `server_updated_at` with a 5-second overlap, so clock differences between phone and PC don't matter. Sync runs pull → merge → push.
- **Merge rules:** progress takes the max of mastery, completions and best accuracy. Game scores take the max. Review logs are append-only. Everything else is last-write-wins. Practice-pack deletions are soft deletes (`deleted: true`), so they sync.
- **Supabase keys** live in `.env.production`. The anon/publishable key is public by design; row-level security restricts every row to its owner.
- **Sign-in:** an email magic link (PKCE flow, so it doesn't collide with the app's `#/` routes), with an optional code box.
- **Backup restore** merges using the same rules as sync, so it never overwrites newer progress.
- **Games:** every score is "higher is better", so personal bests merge with max(). Games pick words weighted towards due, missed and shaky items, and record each word at most once per game for review.
- **Practice packs:** ids must start with `p-`. Packs are validated with zod plus cross-reference checks (tokens spell the sentence, referenced ids exist, syllable counts match). Pack audio uses the browser's own Chinese voice, since packs can't be recorded at build time. The example inside `content/practice-pack-prompt.md` is checked by a unit test, so the prompt can't drift from the schema.
- **Speaking:** off by default and never affects progress or reviews. It uses the browser's Web Speech API (zh-CN) plus pitch detection with `pitchy`, drawn against stylised tone shapes.
- **CI:** the audio job passes the generated MP3s to the build job as an artifact. Each deploy then builds exactly the pushed commit, with no race against newer pushes.
- **Content ids:** several words clashed on the same pinyin id (会/回, 进/斤, 碗/玩). The validator caught each one, and the newer word gets a meaning suffix.

## More sentence production, role-play (owner request)
- The owner asked for more sentence production. The lesson mix moves from 50/25/15/10 to about 45% listening, 35% production, 12% recognition and the rest other. Listening is still the largest share.
- Typed answers (English to pinyin, typing a reply) now allow sentences up to 14 syllables instead of 8.
- When a lesson targets a new word, "write this in pinyin" uses a known sentence containing that word 60% of the time, so vocabulary is produced in context.
- Role-play mode for every story (and for practice packs with a dialogue): the learner picks a part (米格 by default), the other lines play as audio, and their own lines are typed in pinyin from the English. Wrong lines are retyped until right; the first attempt is recorded for reviews.

## Full HSK 1–3 vocabulary (owner request)
- 15 new units (u14–u28) cover every remaining HSK 1–3 word (HSK 2.0 lists: 150 / 150 / 300). New units are added at the end of their HSK section; unit `order` is renumbered to match the path.
- Her family is from Beijing, so later units use Beijing forms where natural (哪儿, 这儿, 咱们, 您 for elders), plus a few local words that aren't on HSK lists: 涮羊肉, 炸酱面, 广场舞, 师傅, 刷碗.
- A few words are introduced earlier than their HSK level because natural sentences need them (骑, 戴, 们, 天, 风, 北, 话).
- Sentence, exchange and grammar ids now carry the unit number (s14-…) to avoid clashes.

## Progress page
- A Progress tab shows HSK 1–3 coverage (known = FSRS card in Review state; settling in = seen but not stable), the level being worked on (first HSK level under 80% known), reviews due now and over the next 7 days, tone accuracy by ear (from tone-identification answers), common tone mix-ups (also from typed answers with wrong tones, now logged), most-missed items, answers per day for 14 days, and per-unit progress. No streaks or points.

## Music (owner request)
- Spotify Web API from the browser with the PKCE flow (no secret, no server). Development-mode apps need Spotify Premium and allow up to 5 users, which fits a personal app. The Client ID is public and lives in `.env.production`.
- Song candidates come from Spotify searches by artist and genre for 8 Mandarin "scenes"; the scenes are pre-picked from the listener's top artists' genres.
- Lyrics come from LRCLIB at runtime on the device and are never stored in the repo, the database or sync. Lyrics are converted to simplified (`public/dict/t2s.json`, built from CC-CEDICT in CI), segmented with the dictionary and scored: known/learning words, words within your HSK level, and harder words. Cantonese and mostly-English lyrics are skipped.
- The app keeps one private playlist ("学中文: songs at my level") and replaces its songs each time it's saved. "Follow along" polls the currently playing track and highlights the current line of timed lyrics.

## Tiles and pinyin
- Word tiles support drag and drop (pointer events, works with touch and mouse): reorder answer tiles, drop pool tiles at a position, or drag a tile out to remove it. Tapping still works.
- New pinyin display mode "On hover": pinyin space is kept but only shown for the hovered word.

## Audio cut off (again)
- Some recordings from edge-tts came back as only the first syllable (about 0.4 s). The generator now checks each recording's length and retries short ones; the 216 affected files were deleted and regenerated, and audio URLs got a refresh tag so devices fetch the new files.

## Typing instead of word tiles
- Tile exercises (listen and build) have a "Type it instead" toggle: type the whole sentence in pinyin or characters, checked like the other typed answers. The choice is remembered on the device.
