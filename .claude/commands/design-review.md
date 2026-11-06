---
description: Design review. Five critical reviewers (colour, typography, motion, layout, overall) score the app; up to 5 proposals with before/after previews; Mikkel approves; approved ones are built
argument-hint: "[your notes, e.g. focus on the session screen]"
model: claude-opus-5-5
effort: medium
---

Run a design review of the app. Mikkel's notes (may be empty): $ARGUMENTS

The reviewers run on sonnet (set in their agent files). Combining, previews and building are done here in the main session (Opus 5.5, medium effort, same as /build), never handed to a subagent. No paid APIs or services. Browsers are always headless and muted (`e2e/launch.ts`); only use the npm scripts and configs below.

`<date>` = today as YYYY-MM-DD. `<run>` = `design-review/<date>` (git-ignored; if it already exists, add `-2`, `-3`…).

## 1. Start
1. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Make a to-do list for steps 2–8 and keep it updated.
3. If `node_modules` is missing, `npm install`. Clean up leftovers from an earlier run: `git worktree list`; for any `.design-worktrees/<name>`, run `npx tsx scripts/design-preview.ts remove <name>`.

## 2. Capture (once, shared by all reviewers)
1. `npm run build`.
2. `npm run design:shots -- <run>/current` (all main screens at 412px and 1440px, light and dark, including a session with a wrong and a right answer) and `npm run design:motion -- <run>/current` (frame sequences, normal and reduced motion). Both take about a minute each.
3. Check a couple of the images exist; if a run failed, fix the spec (`qa/design.spec.ts`, `qa/design-motion.spec.ts`) before going on.

## 3. Review (in parallel)
Start **design-colour**, **design-typography**, **design-motion**, **design-layout** and **design-overall** in one message (five Agent calls, so they run in parallel). Give each:
- the screenshot folder `<run>/current` (motion frames are in `<run>/current/motion`),
- Mikkel's notes, if any ("cover this first and most thoroughly"),
- a reminder: report only, don't edit app files, don't commit; use its own port for extra shots.
Don't pass one reviewer's output to another.

## 4. Combine into at most 5 proposals
From the five reports (up to 15 improvements):
- Note the five scores and one-line reasons.
- Merge overlaps (e.g. two reviewers both asking for stronger feedback colours → one proposal).
- Drop anything that conflicts with `DECISIONS.md`, with CLAUDE.md, or with a proposal `DESIGN_SCORES.md` lists as rejected (unless the reviewer gave a new reason).
- Make sure the proposals work **together**: a new palette and a new font, a new spacing scale and a new card style, or a new motion style and a colour change, must not clash; if they would, combine them into one proposal or pick one.
- Rank by expected gain ÷ size, keep the best **5 or fewer**. Number them P1…Pn. For each: title, one-line summary, which reviewer(s) and score area it targets, expected gain, size (S/M/L), files, affected screens.

## 5. Preview each proposal (never on main)
For each proposal Pn, one at a time (say "Preview X of Y: <title>"):
1. `npx tsx scripts/design-preview.ts worktree pN` → a temporary worktree at `.design-worktrees/pN`, detached from main, without the audio files, sharing node_modules.
2. Make the change **only inside `.design-worktrees/pN/`** (edit files by their path there). A quick, faithful version is enough for a preview, but it must look like the real thing.
3. `npx tsx scripts/design-preview.ts build pN` (fix errors until it builds).
4. Screenshots of the affected screens (comma list, e.g. `session,stats`; screen names: home, session, tone-gym, library, stats, settings, music):
   - after: `npx tsx scripts/design-preview.ts shots <run>/pN/after <screens> --dir .design-worktrees/pN`
   - before: `npx tsx scripts/design-preview.ts shots <run>/pN/before <screens>` (main's build from step 2).
   - Motion proposals: also `motion <run>/pN/after --dir .design-worktrees/pN` and `motion <run>/pN/before`, and describe the difference in words in the question, since stills can't show it.
5. `npx tsx scripts/design-preview.ts compare <run>/pN "Pn: <title>"` → `<run>/pN/compare.html` (before | after side by side).
6. Look at a few before/after pairs yourself with Read. If the preview looks broken or doesn't show the change, fix it in the worktree and re-shoot.
7. Keep the diff for building later: `git -C .design-worktrees/pN diff > <run>/pN/change.diff`.
8. `npx tsx scripts/design-preview.ts remove pN` (always, even if something failed). Confirm `git status` on main shows no changes from the preview.

## 6. Ask Mikkel (in the terminal)
Use **AskUserQuestion**, at most 4 questions per call (a second round for P5). One question per proposal, written so it stands on its own:
- question: `Pn: <one-line summary>. Targets <area> (now N/10, about +X), size S/M/L. Before/after: <full path to <run>/pN/compare.html>`
- header: `Pn <area>` (max 12 characters)
- options: `Approve` ("Build it on main now"), `Reject` ("Don't build; it's remembered so it isn't proposed again"), `Decide later` ("Saved in IDEAS.md as a proposed design idea")
If he answers "Other" with a comment, follow it (e.g. "approve, but softer colour" → approve with that change).

## 7. Build the approved ones on main, one at a time
For each approved proposal (say "Proposal X of Y: <title>"; one-line status after each):
1. Apply it on main properly (use `<run>/pN/change.diff` as the starting point, but write it cleanly, following ARCHITECTURE.md and the existing code style; respect `prefers-reduced-motion`, both themes, both widths).
2. Update unit/e2e tests if behaviour or labels changed. `npm test` and `npm run build` until both pass.
3. Run the **qa** subagent (sonnet) with what changed and which screens to check; review its small fixes and re-run `npm test` if it changed code.
4. Note the choice in DECISIONS.md (dated heading) so future reviews don't undo it.
5. Commit (`Design: <title> (design review <date>)`) and push to main before the next one.
If tests can't be made to pass, revert that proposal, mark it "not built (why)" in the scorecard and move on.

## 8. Record and finish
1. **DESIGN_SCORES.md**: add a new section at the top of `## Reviews` (newest first; replace "(none yet)"; never delete old sections):
   ```
   ## <date>
   Notes: <Mikkel's notes or "none">
   | Area | Score | Reason |
   |------|-------|--------|
   | Colour | N/10 | one line |
   | Typography | N/10 | one line |
   | Motion | N/10 | one line |
   | Layout | N/10 | one line |
   | Overall | N/10 | one line |

   | # | Proposal | Area | Size | Decision |
   |---|----------|------|------|----------|
   | P1 | title | colour | S | built / approved, not built (why) / rejected / decide later (IDEAS #n) |
   ```
   Also keep the **Score history** table at the top of the file up to date (one row per review: date, colour, typography, motion, layout, overall; older rows without layout/overall show "–").
2. **IDEAS.md**: each "Decide later" proposal becomes a row: next free ID, title, status `proposed`, type `design`, one-line why (including the target score), size, source `design-review`, today's date.
3. Commit (`Design review <date>: scores C/T/M/L/O, built N`) and push. Check `git status` is clean (the `design-review/` folder is git-ignored and stays on disk for Mikkel).
4. End with a short plain-language summary: the five scores (and the change since the last review, if any), what was built and where to see it in the app, what's waiting in IDEAS.md (run `/ideas` to decide, `/build` to build), and the path to `<run>` for the previews.
