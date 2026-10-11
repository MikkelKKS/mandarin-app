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
