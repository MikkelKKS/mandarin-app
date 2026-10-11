# Decisions log

Choices made where CLAUDE.md was silent, plus notable incidents. Newest at the bottom.

## Setup
- **Hosting: GitHub Pages**, deployed by a GitHub Actions workflow on every push to `main`. The repo already exists, so no extra account; served over HTTPS, which PWAs need for install on Android (Samsung S25) and desktop Chrome/Edge.
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
- **First 3 HSK 1 units** are Greetings & introductions, Family, and Food & drink. They were picked over Numbers & time because the owner's goal is talking with his girlfriend's family. Numbers 1–10 are covered in "Check your basics", and Numbers & time is the next unit to add.
- **Audio:** two voices (Xiaoxiao female, Yunxi male) for every word, sentence and drill syllable. Sentences also get a slow version (−35%). Words have no slow file and are played at 0.7× instead. Dialogues use each speaker's voice.
- **Erhua (儿) is avoided** in content for now (哪里 rather than 哪儿, 一点 rather than 一点儿), because syllable alignment assumes one character per syllable.
- **Mastery:** every completed lesson raises a node's mastery by 1 (max 5), whatever the accuracy. Wrong answers are re-queued within the lesson (up to twice) and come back in Practice. Test-outs need 80%.
- **Unlocking:** a node opens when the previous one is done, or when anything later in the path is done (after a test-out, skipped material stays open).
- **Answer grading for reviews:** correct/typo → FSRS Good, missing tones → Hard, wrong → Again. Only the first attempt per exercise is recorded.
- **Citation tones** for neutral-tone leniency are computed at build time (Vite plugin) so the ~300 KB pinyin dictionary isn't shipped to the browser.
- **Routing** uses URL hashes (`#/lesson/…`), so GitHub Pages never returns 404s on refresh.
- **Sound effects** are synthesised with the Web Audio API, so there are no audio assets to license.
- **Look:** jade green for progress and correct answers, cinnabar red for the seal-style app icon and wrong answers, gold for mastery rings. Characters and pinyin are coloured by tone (1 red, 2 orange, 3 blue, 4 purple, neutral grey), which can be switched off in Settings.
