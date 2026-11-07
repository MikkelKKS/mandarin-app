---
description: Design review. Two critical reviewers score five areas (colour, typography, layout; motion, overall), the art director keeps a design direction, up to 5 proposals with before/after previews checked by a blind judge; Mikkel approves; approved ones are built
argument-hint: "[your notes, e.g. focus on the session screen]"
model: claude-opus-5-5
effort: medium
---

Run a design review of the app. Mikkel's notes (may be empty): $ARGUMENTS

Lineup (Mikkel, 2026-11-07, to save his 5-hour limit): **design-visual** (colour, typography, layout) and **design-experience** (motion, overall) on sonnet; **design-director** on opus (only when there's no `DESIGN_DIRECTION.md` yet or Mikkel's notes ask for a new direction); one **design-judge** (sonnet) for all previews; one **qa** run at the end. Combining, previews and building are done here in the main session (Opus 5.5, medium effort), never handed to a subagent; load the **frontend-design** skill (`frontend-design:frontend-design`) before making previews.

What may change and what's protected: see DECISIONS.md "Design freedoms" (2026-11-07). In short: the look, fonts, game feel, Home and Stats layouts, whole-screen redesigns and new features or content that serve the design are open; how learning works, hanzi off by default in listening, the tone-colour meanings and the Quick-on-phone / Deep-on-PC swap are protected. No paid APIs or services. Browsers are always headless and muted (`e2e/launch.ts`); only use the npm scripts and configs below.

`<date>` = today as YYYY-MM-DD. `<run>` = `design-review/<date>` (git-ignored; if it already exists, add `-2`, `-3`…).

## 1. Start
1. Work on main: if the current branch is `design-loop` (a /design-loop run was interrupted), commit and push it as it is, then `git checkout main`. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Make a to-do list for steps 2–8 and keep it updated.
3. If `node_modules` is missing, `npm install`. Clean up leftovers from an earlier run: `git worktree list`; for any `.design-worktrees/<name>`, run `npx tsx scripts/design-preview.ts remove <name>`.

## 2. Capture (once, shared by all reviewers)
1. `npm run build`.
2. `npm run design:shots -- <run>/current` (all main screens at 412px and 1440px, light and dark, on a lived-in profile plus `home-new`/`stats-new` for a brand-new account) and `npm run design:motion -- <run>/current` (frame sequences, normal and reduced motion). Both take about a minute each.
3. Check a couple of the images exist; if a run failed, fix the spec (`qa/design.spec.ts`, `qa/design-motion.spec.ts`) before going on.

## 3. Review (in parallel)
Start **design-visual** and **design-experience** in one message (two Agent calls, parallel). Give each:
- the screenshot folder `<run>/current` (motion frames in `<run>/current/motion`),
- Mikkel's notes, if any ("cover this first and most thoroughly"),
- a reminder: report only, don't edit app files, don't commit; use its own port for extra shots;
- permission: "You may read the latest entry in `DESIGN_SCORES.md`, so you don't re-propose rejected ideas." (Never DESIGN_LOOP.md.)
Don't pass one reviewer's output to another.

**Direction:** if `DESIGN_DIRECTION.md` doesn't exist, or Mikkel's notes ask for a new look, then run **design-director** with `<run>/current`, both reports and his notes; it writes `DESIGN_DIRECTION.md` and returns a build plan. Otherwise proposals follow the existing direction.

## 4. Combine into at most 5 proposals
From the two reports (up to 8 improvements) and the director's plan, if it ran:
- Note the five scores, the failed checklist items, and one-line reasons.
- Merge overlaps (e.g. two reviewers both asking for stronger feedback colours → one proposal).
- Drop anything that conflicts with `DECISIONS.md`, with CLAUDE.md, or with a proposal `DESIGN_SCORES.md` lists as rejected (unless the reviewer gave a new reason).
- Make sure the proposals work **together**: a new palette and a new font, a new spacing scale and a new card style, or a new motion style and a colour change, must not clash; if they would, combine them into one proposal or pick one.
- Prefer coherent moves that follow `DESIGN_DIRECTION.md` (a whole-screen redesign is fine) over scattered small tweaks.
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
5. `npx tsx scripts/design-preview.ts compare <run>/pN "Pn: <title>"` → `<run>/pN/compare.html` (before | after side by side; only pages that changed: identical pairs are left out, and pairs that differ only by noise are deleted before re-running `compare`, as Mikkel asked on 2026-11-07).
6. Look at a few before/after pairs yourself with Read. If the preview looks broken or doesn't show the change, fix it in the worktree and re-shoot.
7. Keep the diff for building later: `git -C .design-worktrees/pN diff > <run>/pN/change.diff`.
8. `npx tsx scripts/design-preview.ts remove pN` (always, even if something failed). Confirm `git status` on main shows no changes from the preview.

**Judge the previews (one design-judge for all):** for each proposal, `npx tsx scripts/design-preview.ts pairs <run>/pN/before <run>/pN/after <run>/judge/pN --only <phone/light,pc/light prefixes of its screens>` (at most ~4 screens per proposal), then start one fresh **design-judge**: "Compare the pairs in each folder under `<run>/judge`. Report only." Decode with `design-review/keys/pN.json` (per screen: better / worse / same, as in /design-loop). A proposal the judge finds worse is dropped (say so in the summary); one it finds the same is still shown, with that said in its question.

## 6. Ask Mikkel (in the terminal)
Use **AskUserQuestion**, at most 4 questions per call (a second round for P5). One question per proposal, written so it stands on its own:
- question: `Pn: <one-line summary>. Targets <area> (now N/10, about +X), size S/M/L. Judge: <better on k of m screens / no clear difference>. Before/after: <full path to <run>/pN/compare.html>`
- header: `Pn <area>` (max 12 characters)
- options: `Approve` ("Build it on main now"), `Reject` ("Don't build; it's remembered so it isn't proposed again"), `Decide later` ("Saved in IDEAS.md as a proposed design idea")
If he answers "Other" with a comment, follow it (e.g. "approve, but softer colour" → approve with that change).

## 7. Build the approved ones on main, one at a time
For each approved proposal (say "Proposal X of Y: <title>"; one-line status after each):
1. Apply it on main properly (use `<run>/pN/change.diff` as the starting point, but write it cleanly, following ARCHITECTURE.md and the existing code style; respect `prefers-reduced-motion`, both themes, both widths).
2. Update unit/e2e tests if behaviour or labels changed. `npm test` and `npm run build` until both pass.
3. Note the choice in DECISIONS.md (dated heading) so future reviews don't undo it.
4. Commit (`Design: <title> (design review <date>)`) and push to main before the next one.

After the last one: **one qa run** (sonnet) listing every built proposal and only the screens they touch (`npm run qa:screens` plus a few targeted shots); fix what it finds in one commit, `npm test`, build, push.
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
