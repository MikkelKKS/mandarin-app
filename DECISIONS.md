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

## Missing recordings
- If a recording is missing in one voice, the app plays the other voice (and for slow sentences, the normal-speed file slowed down) before falling back to the browser voice.

## Design pass and follow-along pinyin
- Shared motion tokens and small animations (page entrance, exercise slide-in, node pop-in, ring fill, bars growing, press states, end-screen stamp); all disabled under prefers-reduced-motion.
- Follow along always shows pinyin (from pinyin-pro, loaded on demand, so readings fit the context) and lights words up across the current line. LRCLIB timing is per line, so the words are spread evenly over the line.

## Stories (reading)
- `content/stories/*.json`, one story per file: original texts about the owner's life (studies, insurance job, running, games, her family in Beijing). Each story names the unit it follows; the validator checks that every character is taught by then, except a few listed `extra` words with glosses (shown with a dotted underline).
- Reading only. Pinyin follows the "Pinyin above characters" setting (pinyin-pro for context-aware readings); tapping a word opens the same word card as the music lyrics. A story opens once you finish (or pass) its unit.
- End screen: "Fixed along the way" now counts exercises answered wrong first time, not item ids (sound drills have none).

## Leeway for 一个
- Typed answers accept 一个 left out or added (我有哥哥 / 我有一个哥哥), shown as correct with the course version as "Another correct answer".
- Typed answers also accept everyday equivalents (您/你, 咱们/我们, 哪儿/哪里, 这儿/这里, 那儿/那里, 一点儿/一点, 一会儿/一会). For other rewordings (a wrong answer with different words, not wrong tones), the feedback offers "I was right", which counts the exercise as correct. Real meaning-checking would need an AI model at runtime, which the brief rules out.
- Possessive 的 right after a pronoun is optional in typed answers (我爸爸 / 我的爸爸, 我手机 / 我的手机).

## 2026-10-27: Redesign step 2, the vocabulary pipeline
- `scripts/build-vocab.ts` merges HSK 3.0 (ivankra/hsk30, pinned commit), frequency ranks and classifiers (drkameleon/complete-hsk-vocabulary, pinned), CC-CEDICT glosses and Tatoeba sentences into `content/data/words.json` and `sentences.json`. Nothing is typed by hand.
- Word ids are `<tone-number reading>-<5-char hash of characters + reading>` (e.g. `ba4ba5-u8v1i`), so they stay the same between rebuilds and tell 行 xíng from 行 háng.
- Old course word ids are kept in `legacy`, so existing progress can be migrated in step 4. Course words outside HSK 3.0 (丹麦, 胡同, 遛弯儿…) are kept as level 0.
- Course pinyin written with spoken tone changes (一 yì, 不 bú) is stored with dictionary tones, as the brief asks.
- Example sentences follow "i+1": the sentence's hardest word is the word itself, or at most 300 words further on. Max two per word. Hand-checked course sentences win ties.
- Tatoeba sentences are kept only if simplified, 3–18 characters, without Latin letters or digits, translated into English, and made only of HSK or course words (plus a few common names such as 汤姆).
- CC-CEDICT and Tatoeba can't be downloaded from the coding sandbox, so the `build-vocabulary` GitHub workflow downloads them, runs the build and commits the result.

## 2026-10-27: Redesign step 3, pinyin input and scoring
- **Every syllable gets its own result**, even when other syllables are wrong: right, wrong tone, no tone, wrong syllable or left out, plus any extra syllables. Typed syllables are lined up with the answer by edit distance, so one missing word doesn't shift everything after it.
- **Strict tones are the default** (the owner chose this): a wrong or missing tone counts as wrong (FSRS Again). Lenient mode, in Settings, counts right syllables with a tone slip as "almost" (Hard). A wrong syllable is never lenient. Existing devices are switched to strict once.
- A one-letter typo on a long answer still passes, but only if every tone is right.
- Tones from every typed answer are now logged (not just wrong ones), so the confusion matrix in step 6 has the correct answers too.
- **Live tone marks:** a tone number typed right after a syllable becomes a mark (ni3 → nǐ, nv3 → nǚ, u: → ü; 5 or 0 drops the number). The syllable is the longest valid one at the end of the letters; use an apostrophe or space where that's ambiguous (fāng'àn).
- The tone row is now 1 2 3 4 5 (5 removes the mark) plus ü, coloured by tone.
- **Tone colours** follow the brief: 1 red, 2 orange, 3 green, 4 blue, neutral grey. Settings keeps the on/off switch.

## 2026-10-27: 你 instead of 您, 爸/妈 for her parents (owner request)
- Course sentences, dialogues, stories and grammar notes use 你, never 您 (40 sentences changed). 您 stays as an HSK word so it can be recognised, with a note that 你 is always fine. Tatoeba example sentences containing 您 are skipped by the vocabulary build.
- 米格 calls her parents 爸 and 妈 (new words 爸 and 妈, taught in "Meeting her parents"); stories say 她妈妈. 叔叔 and 阿姨 stay as words in their general sense (uncle, aunt, what children call adults) and are taught with the other family words.
- Changed lines keep their ids, so progress carries over. Their recordings still say the old words until the audio is regenerated.
- **Faster deploys (until Azure replaces edge-tts):** the edge-tts step is capped at 8 minutes on pushes (90 on the nightly run), and the audio manifest is now saved per item. Before, one failed clip meant nothing was saved, so every changed line was re-recorded on every deploy.

## 2026-10-27: Redesign step 4, review engine
- **Facet cards:** every word has a card per skill: `<word id>#lm` (listening → meaning), `#lp` (listening → pinyin), `#mp` (meaning → pinyin), `#sp` (speaking). They live in the existing `reviewItems` table, which already syncs one JSON row per card, so Supabase needed no change. Sentences keep one card each.
- **Meeting a word** (its intro card) creates its three listening/typing cards, ungraded. Speaking cards are made the first time speaking is practised, and are skipped (not shown, not failed) while the microphone is off.
- **Which exercise trains what:** listening multiple choice → lm; dictation, tone exercises and tone games → lp; typing from English, gap fill, sentence building, role-play → mp; repeat-after-me → sp. Character recognition exercises no longer update word cards (characters are out of scope).
- **Auto-grade:** wrong → Again; tone slip in lenient mode → Hard; right but slow (over 12 s for multiple choice, 10 s + 2.5 s per syllable when typing) or with a hint → Hard; right → Good. After each answer the grade is shown with a "Change" link (Again / Hard / Good / Easy). Changing it redoes the review from the card as it was; the first log entry is kept and marked `replaced`.
- **Full review log** for a later "Optimise my scheduler" (from 1,000 reviews; comes with the stats step): card, rating, state before, days since last review, new interval, stability, answer time, and whether it was overridden.
- **Settings:** target retention 85 / 90 / 95% (default 90%), new words per day 5 / 10 / 15 / 20 (default 10), reviews per day 100 / 200 / 500 / no limit (default 200). The day rolls over at 4 am, like Anki.
- **Queue:** due reviews first, ordered by how late they are relative to their interval, then new words in HSK 3.0 learning order (level, then frequency), both capped by what's left of today's limits. Sessions that work through it come with step 7.
- **Your progress carried over:** each old course word card is copied onto the word's lm, lp and mp cards. The copy only happens when the old card is newer than the facet card, so it is safe to run repeatedly: it runs at start-up and after every sync, which also catches up answers from a device still running the old version. Old cards are kept, not deleted.
- **Course screens** (Progress, HSK words, Games, Practice) see one card per course word: the word's weakest listening/typing card.
- The HSK 3.0 word list ships as its own on-demand chunk (about 530 KB compressed), precached for offline use.

## 2026-10-27: Redesign step 5, audio with Azure
- Runs on GitHub (`azure-audio` workflow) with the owner's key stored as the repository secrets `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`; locally a git-ignored `.env` works too. The owner chose GitHub so nothing has to be installed.
- Voices: Xiaoxiao (female) and **Yunxi** (male). Yunjian was in the first sample and dropped by the owner: it mispronounced too many sentences. Default speaking style only.
- Output MP3, 24 kHz, 48 kbps mono. Slow versions of sentences at −20% (0.8×).
- **Billing:** Azure bills everything inside `<voice>`, markup included, and each Chinese character twice. `content/data/azure-usage.json` counts billed characters per month; the script stops 20,000 short of the 500,000 free characters and carries on next month.
- **Pronunciation hints** (`<phoneme alphabet="sapi" ph="kong 4">`; Azure accepted the spaced format) only where pinyin-pro's default reading differs from ours, ignoring tone changes Azure makes itself (一, 不, 3-3), and in sentences ignoring neutral tones. The hint wraps just that word: the first sample wrapped whole sentences, and Azure then read 你明天有空吗 syllable by syllable, which sounded bad.
- **One voice (owner, 27 Oct):** after listening, the owner chose **Xiaoxiao only**, which also halves the cost. Only sentences that male characters alone speak in the course dialogues (米格, the male neighbour: 107 lines) use **Yunxi**; anything not clearly male is Xiaoxiao. The voice picker in Settings is gone, and older recordings default to the female voice too. Tone Gym still gets several voices from the Tone Perfect human recordings (step 6).
- **Slow versions at 0.7×** (owner found 0.8× not slow enough), `<prosody rate="-30%">`. They are generated last, since the speed markup is billed (about 520,000 characters for all sentences); until a sentence's slow file exists, the turtle slows the normal recording to 0.7× in the browser (pitch kept).
- **Bulk order:** each word in learning order followed by its example sentences, then the remaining sentences, then the slow versions. Files `public/audio/az/<id>.mp3` and `<id>.slow.mp3`; `content/data/azure-audio.json` remembers what each file was made from, so edited text is re-recorded. Normal recordings need about 268,000 characters, which fits this month's free quota.
- **Rate limit:** the free tier allows 20 requests a minute, so the `azure-audio` workflow runs every 6 hours for up to 5⅓ hours and carries on where it stopped (about 4 runs for the normal recordings). The repo is public, so GitHub Actions minutes are free.
- **App:** plays the Azure recording first (course words via their HSK 3.0 id), then the older edge-tts recordings, and the browser's voice only as a last resort. The edge-tts step is removed from deploys.
- **Report bad audio:** a small button under the answer in every lesson feedback and on every word card. Reports go into a new synced table, `audioReports` (Supabase `audio_reports`, created by `supabase/migrations/002_audio_reports.sql`). Until the owner runs that SQL, sync skips the table and keeps the reports, then sends them all once the table exists.
- Each `azure-audio` run first re-records open reports: Xiaoxiao again with every word's pronunciation spelled out; reported a second time, Yunxi. The job reads and updates the reports with the Supabase service key (GitHub secret `SUPABASE_SERVICE_KEY`), records the choice in `content/data/azure-overrides.json` so bulk runs keep it, and marks the report fixed. Fixed items get a new cache key in the app, so the new file is fetched.
- **Tone Perfect:** the full set is only given out on request (non-commercial or educational use; rights statement "Educational Use Permitted"), and their site blocks automated access. The owner has sent the request form. Until it arrives, the Tone Gym uses the recordings we have.
