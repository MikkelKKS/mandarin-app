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

## 2026-10-27: Redesign step 6, Tone Gym
- `#/tone-gym`, with big entry cards at the top of Learn and Games. Four modes, each a round of 20 with a personal best (stored in `gameScores` as `tonegym:<mode>`, so it syncs): **Workout** (about 40% single tones, 60% pairs, adaptive), **Single tones** (minimal quads: pick mā / má / mǎ / mà), **Tone pairs** (two-syllable words, all 20 combinations of 1–4 × 1–4 and neutral), **Tone changes** (3+3, 不, 一).
- Items are HSK 3.0 words with one or two syllables that have recordings (no 儿化). **Answers are dictionary tones**; after answering, the spoken form and the rule are shown (你好 → spoken ní hǎo).
- **Speakers:** every Azure recording (Xiaoxiao) plus, for the old course words, the older Yunxi and Xiaoxiao recordings. Each item starts with a random speaker, and "Another voice" switches. Tone Perfect's six speakers will be added when MSU sends the files.
- **Adaptive:** each pick chooses a tone pattern with probability ∝ 0.15 + smoothed error rate ((wrong + 1) / (tries + 3), so unpractised patterns count as a 1-in-3 miss), using the last 60 days of every answer that logged tones (typed answers count per syllable and per adjacent pair).
- **Feedback** after every item: wrong answers replay the right recording at once; "What 2–3 sounds like" plays a word with the tones you chose (the same syllables when one exists).
- **Confusion matrix** (rows: the right tone; columns: what you heard or typed; each row as %), with 3+3 → 2+3 counted as right, plus the most frequent pair mix-ups. On the Tone Gym page and after each round; the Stats screen will reuse it.
- Gym answers are logged (`exercise: tonegym:<mode>`, with tones) but don't change review cards: it's ear training, not vocabulary review.
- Keyboard: Space replays, 1–4 (and 0 or 5 for neutral) answer, Enter continues.

## 2026-10-27: Redesign step 7, sessions, new words, XP
- **Home** (`#/`) replaces the path: daily goal ring, streak, level, reviews due and new words today, **Quick session** (the big button on phones) and **Deep session** (the big one on wide screens), resume, Tone Gym with the weakest pair of the week, achievements. The 29 hand-written units are now **Conversations** (`#/conversations`), linked from Home. Tabs: Home, Tones, Read, Games, Progress, Dictionary, Settings (Practice lives on the Conversations page).
- **Quick:** up to 24 due reviews with a Tone Gym question after every 4 (up to 6); if fewer than 8 are due, 3 new words too; leftover tone questions at the end.
- **Deep:** reviews (up to 80) → new words (up to the daily limit, at most 10) → listening (8 sentences made only of words you've started: short ones as dictation, the others "do you understand it?") → Tone Gym round of 20. Speaking joins in step 9. The progress bar shows the blocks.
- **New words** come from the HSK 3.0 list in learning order (level, then frequency), skipping words that already have cards (your course words were carried over in step 4). Each word: an intro (heard twice, meaning, example sentence), one multiple-choice "what does it mean?" (the only multiple choice outside the Tone Gym), then typed by ear and from English, then its example sentence.
- **Reviews by facet:** listening → meaning: hear it, optionally type the meaning (a generous matcher suggests the grade), reveal, grade yourself (Again/Hard/Good/Easy, keys 1–4); listening → pinyin: dictation; meaning → pinyin: type from English. Typed answers are auto-graded with the step 3 scorer, with "Change" and "I was right".
- Wrong answers come back once at the end of their block (half XP).
- **XP:** right 10, almost 6, wrong 2, a new word 5, Tone Gym 5 / 1; a **combo** adds 10% per answer in a row, up to ×2. Stored on each log entry (`xp`), so XP syncs with the append-only log and both devices agree. **Level** L needs 50·L·(L−1) XP (100 for level 2, 300 for 3…).
- **Daily goal** in XP (default 100; 50/100/200/300 in Settings). **Streak:** days with the goal met; the day rolls over at 4 am. A **streak freeze** is earned every 7 goal days in a row (at most 2 banked) and is used automatically on a missed day. All computed from the log.
- **15 achievements** (first session, 7/30/100-day streaks, 100/1,000 words started, 100/500/2,000 mature, 100/1,000 tone pairs right, a flawless Tone Gym round, 25 in a row, 1,000 reviews, level 10). Once unlocked they're kept as `ach:<id>` rows in the synced gameScores table.
- **Resume:** the session in progress is saved after every answer as the row "session" in the synced settings table, and offered on Home for 18 hours on either device.
- **Offline:** a session downloads all its audio when it starts. The HSK word list and the example sentences are precached chunks (precache limit raised to 4 MB).
- **Characters** are off by default ("Characters: Hide/Show" in Settings); sessions show pinyin only.
- Audio for HSK words: Azure first, then the older course recordings of the same word, and the browser's voice as a last resort, flagged under the exercise ("No recording yet, so this was your browser's voice").
- Meanings in exercises are shortened (first gloss without bracketed notes, plus the second if both are short).

## 2026-10-27: Redesign step 8, Stats
- The Progress tab is now **Stats** (`#/progress`): headline tiles (words started and mature, true retention over 7 and 30 days against the target, XP and level), words by state for each HSK 3.0 level (new / learning / young / mature as one jade ramp, light to dark), the 14-day review forecast (today includes overdue), review cards per skill, per-tone accuracy plus the confusion matrix and pair mix-ups, minutes per day, accuracy per day and XP per day for 30 days, and progress towards the scheduler optimiser.
- **True retention** = share of reviews of cards in long-term review (FSRS state Review before the answer) graded Hard or better; new and relearning cards and replaced (overridden) entries don't count. A note compares it with the target once there are 20+ such reviews.
- **Time studied** adds each answer's time, capped at a minute (older entries without a time count 8 s).
- Charts follow the dataviz rules: one hue per chart, columns at most 24 px with a 2 px gap and rounded data end, labels only on the peak and the latest value, a tooltip on hover or focus, and a "Show as a table" view for each.
- **Scheduler optimiser:** the review log has had full FSRS data since step 4; the Stats page counts towards 1,000 such reviews. The "Optimise my scheduler" button itself is built when that count is in sight, so it can be tested on real data.
- "Browse the words" lists all HSK 3.0 words by level (1–6, 7–9) and state, pinyin first.

## 2026-10-27: Redesign step 9, speaking with pitch contours
- **"Use microphone"** replaces "Speaking exercises" and is **on by default** (CLAUDE.md §5); existing devices are switched on once. It only needs microphone recording (MediaRecorder), not the browser's speech recognition, so it works in more browsers. **"No mic right now"** (on Home, in Settings and on every speaking question) pauses speaking for an hour, and takes the speaking questions out of the current session: skipped, never failed, and not scheduled.
- **Speaking cards** (`#sp`) start on words you already know by ear (listening → meaning card in long-term review), most common first: up to 4 new ones per deep session, plus any that are due, in a **Speaking** block before the Tone Gym. With the mic on, due speaking cards also show up in quick sessions.
- **The exercise:** the native recording plays; you record (stops by itself after a few seconds); both pitch contours appear on one chart, the native one coloured by the expected tone of each syllable (the time axis split evenly by syllable), yours in ink. A/B buttons replay native and yours. You grade yourself (Again / Hard / Good / Easy). Recordings stay in memory on the device and are never uploaded.
- **Pitch:** pitchy (McLeod Pitch Method) on 40 ms windows every 10 ms, clarity ≥ 0.7, 60–600 Hz; octave errors folded back, a 5-point median filter and a 3-point average, voiced bits shorter than 40 ms dropped; then semitones from each speaker's own median, on a 0–1 time axis across the voiced part. Tuned on real recordings (说 stays level, 人 rises, 在 falls, 有 dips). The chart's height fits the curves (±3 to ±10 semitones).
- Because each curve is relative to its own middle, the chart compares **shapes** (rise, fall, dip), not absolute height. Automatic grading (phase 2 in the brief) isn't built; self-grading is used.
- The old Conversations "repeat after me" exercise is unchanged (it still uses speech recognition where available).

## 2026-10-27: Redesign step 10, placement, Beijing pack, polish
- **Placement** (`#/placement`, offered on Home until used, and under Settings → Your level): either pick a starting level (every word below it counts as known) or take a short test: 8 words per HSK level, spread over the level's frequency order, heard and typed in pinyin. The test stops after a level under 50%. Levels at 80%+ are marked known in full; for the first level below that, the most common share matching your score; plus every word you got right.
- **Known** means mature listening and typing cards, due spread over 3 to 9 weeks so they come back gradually and FSRS corrects any mistakes. Cards already further along are left alone. Speaking cards aren't created (they start from words you know by ear, as before).
- **Beijing pack** (Settings, off by default): the words from the Beijing-family conversations (incl. 儿化 words) come first among new words.
- **Speed ladder:** the speed button cycles 0.75× → 1× → 1.2× in sessions. **s** = slow on PC, alongside space = replay.
- **Open in Pleco** link on the feedback after each session answer.

## 2026-10-28: "I don't know this word"
- Review questions about a word (listening → meaning, dictation, meaning → pinyin) have an **"I don't know this word"** button, before and (for listening → meaning) after showing the answer. Not on new-word lessons or retries.
- It puts all the word's cards back to new (not started), shows the word, drops its other review questions from the session, and teaches it straight away like a new word (intro, first choice, typing). Its reviews start over from scratch.
- Logged as exercise `unknown` without a card, so it doesn't count against true retention (the word was never really in long-term memory). Asked for because placement marked words as known that weren't.

## 2026-10-28: Moving words by hand
- Stats → Browse the words → **Move words**: tap words (or "Select all" on a group), then move them to Not started, Learning, Young or Mature.
- **Not started:** every card of the word goes back to new (speaking too); it's taught again as a new word. **Learning:** as if just answered "Again" the first time (due within minutes). **Young:** in review, due in 3–14 days. **Mature:** due in 3–9 weeks, as with placement (cards already that far out are kept).
- Manual moves aren't reviews: nothing is added to the review log, so retention stats and the scheduler optimiser only see real answers.

## 2026-10-28: Tone questions out of sessions (for now)
- Quick and deep sessions no longer mix in Tone Gym questions: the neural-voice syllables weren't good enough to learn tones from. The Tone Gym page keeps them.
- Settings → **Tone questions in sessions** (off by default) brings them back; the plan is to turn it on once the Tone Perfect recordings (6 real speakers) are in.

## 2026-10-28: Clean-up of the whole app
- **Asked:** keep Conversations as a side section with progress shared both ways; keep Read (Stories), Music and the Dictionary; remove the mini-games and AI practice packs; clean files, but don't rewrite git history.
- **Navigation:** five tabs: Home, Tones, Library, Stats, Settings. Library holds Conversations, Stories, Music, HSK words and the Dictionary, with a look-up box at the top.
- **Removed:** the six mini-games (Tone Sort and Tone Pairs were covered by the Tone Gym), AI practice packs, unit test-outs, the old Practice screen (sessions do this now), the old Progress page, the "Audio speed" and "Extra tone practice" settings and the "Can't listen now" settings row (the lesson's own "No audio" button stays). The old edge-tts generator and the old brief (CLAUDE-old.md) are gone from the repo.
- **One picture of what you know** (`lib/knowledge.ts`): every screen reads word stages from the same HSK review cards. Conversations lessons count as done when finished or when you know all their words; lessons no longer re-introduce words you've met; Stories show how much of each you know; Music scores songs against it (it was still reading the old card format).
- **Fixed:** a word met in only one skill counted as "not started". It now counts as learning.
- **Conversations:** no locks; a compact list of units that open to show their lessons (the long winding path is gone).
- **Stories:** every paragraph recorded with Azure (Yunxi, since 米格 tells them), "Play all" and per-paragraph play; no locks.
- **Dictionary:** "Learn next" replaces "Add to my practice" (those words never reached a session). HSK words go to the front of your new words; earlier "My words" were carried over. Words play their Azure recording.
- **Translation:** a Supabase function calling Azure Translator (free F0), only for the owner's account; MyMemory remains the fallback until it's set up.
- **Look:** porcelain and ink. Cool light surfaces, jade for actions, tone colours as the only other bright colours; Instrument Sans (good pinyin tone marks) with Noto Sans SC; hairline borders instead of thick ones; no 3D button lips; one easing curve, short durations; the red seal on end screens is the one flourish. Home has one main action; Settings is grouped with switches; achievements moved to Stats.

## 2026-10-28: Tone Perfect recordings
- MSU's Tone Perfect MP3 Dataset (licence CC BY-NC 4.0: attribution, non-commercial, changes allowed): all 410 syllables in four tones by six native speakers, 9,839 files (MSU deleted one faulty file, jiao1 by woman 3).
- Converted to 40 kbps mono MP3 (60 MB instead of 284 MB) by `scripts/tone-perfect.ts`; loudness was already even across speakers, so nothing else was changed. Credited in About and the README.
- **Single tones** in the Tone Gym now come from these recordings: every syllable in every tone (1,640 items), a random speaker each time, "Another voice" cycles through the six. After a wrong answer, "What you chose sounds like" plays your tone on the same syllable in the same voice. Tone pairs and tone changes still use Azure words (Tone Perfect has single syllables only).
- **Tone questions in sessions** are back on (they were paused until these arrived), now single tones by real speakers only: up to 6 in a quick session, 12 in a deep one.

## 2026-10-28: Quieter Tone Perfect, real recordings only, volume slider
- The Tone Perfect originals are mastered very loud (about −7 LUFS, peaks above full scale). Every clip is now turned down to −20 LUFS, the loudness of the Azure recordings, with at least 2 dB of headroom (`scripts/tone-perfect.ts`, measured per file with ffmpeg's EBU R128 meter). Allowed by the CC BY-NC licence.
- **Tone Gym = real recordings only** (asked): tone pairs and tone changes are gone. Two rounds: **Workout** (weighted to the tones you mix up most) and **Even mix** (all four tones equally). Old links to the removed rounds open a workout. Tone pairs from your typed answers still show in the matrix and as "weakest pair".
- **Volume slider** under every audio player (sessions, lessons, Tone Gym, story reader) and in Settings: one level for all recordings, remembered per device (phone and PC differ), applied to playing audio immediately.

## 2026-10-28: Fixes from Mikkel's list (A)
- **Placement Stop** goes back to the placement start screen (it navigated to the page it was already on).
- **Wrong options** for "What does it mean?" share no meaning term with the word (`lib/gloss.ts`: "to obtain; to get" vs "to acquire; to get" share "get"), aren't exact homophones of it, and aren't synonyms or homophones of each other.
- **Home** says what each session will actually hold (`sessionPreview` in `plan.ts`, same caps as the planner): a quick session is at most 24 reviews, 3 new words only when fewer than 8 reviews are due, and 6 tone questions.
- **Achievements:** the two tone-pair ones (unreachable since the Tone Gym became single tones) are replaced by "Tone ear" (500 tone questions right) and "Golden ear" (2,000), counting the Tone Gym and the tone questions in sessions. Achievements now unlock as soon as they're reached, on Home or Stats, not only when a session ends. "Words started" counts only words actually started (a word with only unseen cards isn't).

## 2026-10-28: Learning improvements B5–B7
- **First meaning question later:** a new word's "What does it mean?" now comes after the next three words' intros (`CHOOSE_GAP`), so it tests memory rather than the last few seconds. The last words' questions come after all the intros.
- **Grammar notes** (`content/grammar-notes.json`, `lib/grammar.ts`): 50 function words (了, 的/得/地, 过, 着, 把, 被, 吧, 呢, 吗, 啊, 就, 才, 都, 还, 又, 再, 比, 跟, 给, 对, 让, 也, 很, 在, 没, 不, 会, 能, 可以, 要, 是, 因为, 虽然, 和, 还是, 或者, 从, 离, 已经, 正在, 太, 最, 只, 越, 如果, 先, 们, 个). Two or three lines in plain English with examples in pinyin, plus one example sentence to hear. Shown on the word's intro (instead of the plain example), and behind a "Grammar" button on word cards, dictionary entries and answer feedback. Matched by characters + pinyin, so dé "to get" doesn't show the note for de. Examples are recorded with Azure (`g-…` ids); a test checks every example's pinyin against its characters.
- **Say it in pinyin** (deep sessions): up to 4 sentences to type in pinyin from English, made only of words you've started, preferring sentences with today's new words and your newest words (few reviews, practised recently), at most 12 characters, not one just heard in the listening block. Scored with the usual sentence checker (strict/lenient tones, typos); "I was right" now works for answers without a review card too.

## 2026-10-28: Learning improvements B8–B9
- **Words heard in a sentence** (`lib/context.ts`): HSK 1–4 words that sound exactly like another HSK 1–4 word (shì, bù, jì…) and neutral-tone particles (le, de, ne, ba, ma, a, guo, zhe…): 344 of 3,217 words. Their listening → meaning and dictation questions (and the first "What does it mean?") play the word's example sentence; the sentence's pinyin is shown with the word marked (meaning) or blanked (dictation: type the missing word), and the feedback shows the sentence with the word highlighted and replays the sentence. Only sentences where the characters really are this word count (的 inside 目的 mùdì doesn't).
- A **neutral-tone particle is never dictated on its own**: without a usable sentence, its listening card is practised from English instead (same card), and placement never picks one.
- **Typing from English** now shows the part of speech and the word's example sentence with the word blanked out (pinyin + English), so "can" isn't a guessing game between néng, huì and kěyǐ. Typing another HSK word whose meaning fits counts as right, with "Also right: … We were looking for …".
- Words now carry their part of speech (and a slot for a short meaning) in the app's word data.

## 2026-10-28: Learning improvements B10–B12
- **An example for every HSK 1–4 word.** Tatoeba first (any sentence of the word for HSK 1–4, even with not-yet-learned words, if no "known words only" one exists). The 354 words still without one got a short sentence written for the app (`content/generated-sentences.json`): dictionary tones, everyday Beijing-flavoured content, marked as generated in the app, all listed in `content/REVIEW_NEEDED.md` for a check. Ranked below any real sentence, so a Tatoeba sentence wins if one appears later. Recorded by the Azure job from 1 November (October's free characters are used up). A test checks every generated sentence's pinyin against its characters.
- **Short learner meanings** (`content/data/short-glosses.json`): one hand-written meaning of at most 40 characters for each of the 3,251 HSK 1–4 words, in everyday English and the sense the HSK means (才 "only then; just", not "ability; talent"; 带 "to bring; to take along", not "band"). Used wherever an exercise shows a meaning (`meaningOf`), also accepted when you type a meaning; word cards and the dictionary keep the full CC-CEDICT text. Higher levels fall back to a trimmed CC-CEDICT gloss. The stray space before commas in CC-CEDICT glosses is removed.
- **Placement asks the meaning too:** after a right dictation, pick the meaning from four (same rules for wrong options as in sessions) or "I don't know the meaning". A word, and a level's score, counts only when both are right, so a word you can spell but don't understand isn't marked known.

## 2026-10-29: Reading track (read characters, never write them)
- **Brief changed (asked):** characters are still never *written* (no handwriting, no stroke order), but Mikkel now wants to learn to **read** them. In the listening and typing exercises characters stay hidden unless "Characters: Show" is on. CLAUDE.md §1, §3.5 and §9 updated.
- **Cards:** two FSRS cards per reading item, character → pinyin (`#rp`) and character → meaning (`#rm`), in the same synced `reviewItems` table. They are kept out of the daily word queue, the word stage, the main retention and the main forecast.
- **Own stage:** each word and character has a reading stage (new / learning / young / mature, weakest of its two cards). The word stage stays listening + typing, so a word known by ear never drops back because it can't be read yet.
- **When a word becomes readable (asked):** once its listening → meaning card is out of the learning steps (in review or relearning), or it was marked known (placement, moving words). Most common words first.
- **Daily limit (asked):** 10 new reading *words* a day by default (Settings, 5 to 20); the characters they bring come on top. Counted from `read-intro` log entries without a `via` (a character met with a word carries its word as `via`).
- **Words and characters:** a word of two or more characters is one item; each character is another, met right after the first word that contains it. A character that is a word on its own (好, 人, 大) shares one set of cards with that word, the most common one if several words are written with it (好 hǎo, not hào). Characters that aren't words get `c-<character>` ids, with the most common reading (how the most frequent HSK word reads it, toned) and a short meaning from Make Me a Hanzi; other readings count as right too.
- **Exercises:** character → pinyin is typed and auto-graded with the usual scorer (strict/lenient tones), with "Change" and "I was right". Character → meaning: an optional guess, Reveal (meaning, pinyin, example or known words with it, building blocks), then Again / Hard / Good / Easy (keys 1–4). After every answer the recording plays: the word's own, or for a character that isn't a word, a real recording of its syllable (Tone Perfect).
- **Building blocks** from Make Me a Hanzi's decompositions and etymology (LGPL 3.0, credited in About and `content/data/MAKEMEAHANZI-LICENSE.md`): "妈 = 女 “woman” + 马 mǎ, which gives the sound", or the origin hint for pictures and compounds.
- **Look-alikes:** `scripts/build-hanzi.py` finds candidates from data: outlines rendered and compared (same shape, mirrored), stroke centre lines matched (one stroke moved or added, strokes shifted), one character plus a small extra part (买 → 卖), and the same right-hand part with another radical (情 / 请 / 清). From its 1,918 candidates, 55 groups of commonly confused characters were picked by hand (`content/lookalikes.json`); a test checks every group is linked by candidate pairs. Shown side by side after a wrong reading answer.
- **Where:** a sixth tab, **Reading** (asked: six tabs), with Character → meaning / Character → pinyin / Mix remembered per device, today's due and new counts, rounds of up to 20 (due first, then new; saved separately from sessions). Deep sessions get a **Reading** block (both directions, up to 15 items, at most 3 new words). Quick sessions are unchanged. No games or timers.
- **Stories:** a "Characters only" mode (no pinyin; a tapped word counts as Again on its character → meaning card, once per visit, only if it has reading cards; untapped words aren't graded). The list shows "You can read X% of the characters" (characters whose reading stage is young or mature).
- **Stats:** a Reading section: words and characters by reading stage per HSK level, reading retention (30 days) and the reading forecast.

## 2026-10-29: Music redesign (lyrics first, Spotify second)
- **Why it found so few songs (confirmed in the code):** `finder.ts` searched Spotify first (a few searches × at most 10 results, `artist:"中文名"` queries that often miss Spotify's romanised names, unreliable `genre:` filters), then looked for lyrics on LRCLIB with an exact title/artist/duration match or a ±8 s search. Most candidates had no match and were dropped. Lyric fetches weren't retried, and four parallel workers could hit rate limits.
- **Song catalogue, built ahead of time** (`scripts/build-songs.ts`, `.github/workflows/songs.yml`: weekly and by hand, no secrets): artists from the app's scene lists plus MusicBrainz artists tagged mandopop, c-pop, chinese rock/indie/folk/hip hop/r&b, taiwanese pop/rock/indie and similar (Chinese and romanised names; Cantopop left out). Their songs are searched on LRCLIB, plus searches for children's songs. Kept: Mandarin (not Cantonese), mostly Chinese, at least 30 words, timed lyrics preferred. Report in `content/data/SONGS_REPORT.md`.
- **Derived data only, no lyrics** in the repo, database or sync. Per song: LRCLIB id, title, artist, duration, timed or not, scene, other spellings (for Spotify), HSK word ids **with how often each is sung**, the number of other words and filler sounds, distinct words, distinct HSK words per level. The counts are kept because "you know X% of the words" counts every time a word is sung (the 95% comfort rule is about running text). Word ids are sorted, so nothing of the lyrics' order is kept.
- **Bands (asked):** comfortable 95%+ known, stretch 85–95%, tough below 85%. Known = words you know or are learning (`lib/knowledge.ts`); fillers (啊, 呀…) count as known, non-HSK words as unknown.
- **Music page:** the catalogue ranked instantly and offline (easiest first, at most 3 per artist near the top), with filters for scene, band and "only timed lyrics". No more searching step, and no Spotify needed to browse.
- **Spotify only when needed** (February 2026 API: search limit 10, no batch `GET /tracks`, playlists use `/items`): opening a song looks it up by track search with title and artist in every stored spelling, picking a result within ±5 s (title must match; a title in another script only with the same artist and within 2 s). The match, or "not on Spotify", is remembered in the synced settings table; not-found songs are tried again after a week. Songs not on Spotify still show their lyrics.
- **Lyrics** are fetched by LRCLIB id (`/api/get/{id}`), retried with growing waits on network errors, 429 and 5xx, cached in memory and by the service worker for a day; "Try again" after a failure.
- **Playlist** "学中文: songs at my level": the top 40 of the current filtered list (songs not on Spotify are skipped), `POST /me/playlists` and `PUT /playlists/{id}/items`.
- **Follow along:** the playing song's lyrics come from the catalogue (remembered match, or same title within 5 s), else a live LRCLIB search (title/artist spellings, ±8 s). A timing nudge (−/+0.5 s) per song on this device; untimed lyrics shown without highlighting, with a note; the English of the current line when the translation function is set up (Azure only, no fallback).
- **Removed:** the Spotify-first search, `genre:` queries, reading top artists to guess genres (and its `user-top-read` permission), the old `/tracks` playlist fallback.
