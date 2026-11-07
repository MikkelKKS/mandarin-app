---
description: Autonomous design loop on the design-loop branch. Five blind reviewers score, the main session improves, repeat until all five give 9+ twice; then Mikkel sees before/after and decides what goes live
argument-hint: "[your notes, e.g. focus on the session screen]"
model: claude-opus-5-5
effort: medium
---

Run the autonomous design loop. Mikkel's notes (may be empty): $ARGUMENTS

**Runs on its own:** never ask Mikkel anything and never show him screenshots or proposals until the loop **stops** (see "Stopping rules"). Exceptions to CLAUDE.md for this command: loop work is committed to the **`design-loop` branch, never to main** (only the final merge he approves goes to main), and you don't ask before pushing the branch.

Models: the reviewers run on sonnet (set in their agent files). Deciding, building and showing are done here in the main session (Opus 5.5, medium effort), never handed to a subagent. No paid APIs or services. Browsers are always headless and muted (`e2e/launch.ts`); only use the npm scripts, configs and `scripts/design-preview.ts`.

**The goal (only you know it):** in one round, all five reviewers (design-colour, design-typography, design-motion, design-layout, design-overall) score **9 or more**, and then a confirmation round with fresh reviewers does too.

**Deploys:** the app only deploys from main (`.github/workflows/deploy.yml` runs on pushes to `main`, a manual start, or after the song/vocabulary workflows, which always build main). Pushing `design-loop` never puts anything live.

## 0. Start or resume
1. Make a to-do list (start/resume, then one item per round as you go, then "Show Mikkel") and keep it updated.
2. If `git status` shows uncommitted changes that aren't from an interrupted loop change, stop and explain simply (don't stash or discard his work). `git checkout main && git pull --rebase` (on conflict: stop and explain). If `node_modules` is missing, `npm install`. Remove leftover preview worktrees (`git worktree list`; `npx tsx scripts/design-preview.ts remove <name>`).
3. Does the branch exist? `git fetch origin` then `git branch -a --list '*design-loop'`.
   - **No branch → new loop.** `git checkout -b design-loop main`. In `DESIGN_LOOP.md` (create it with a one-line intro if missing) add a section `## Loop <k> (started <date>)` with the state block below (`State: running`, `Round: 0`, `Max rounds: 8`, `Best lowest: –`, `Rounds without progress: 0`, `Confirming: no`, `Notes:` his notes or "none"), then a scores table `| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |`. Commit (`Design loop <k>: start`) and `git push -u origin design-loop`.
   - **Branch exists → resume.** `git checkout design-loop && git pull --rebase`. Read the last `## Loop` section of `DESIGN_LOOP.md` (it's the loop's memory; reviewers never see it):
     - `State: running` → continue where it stopped: the next unfinished step of the current round (unchecked changes in the round's plan are still to build; a round with no scores yet starts at REVIEW). If the working tree has a half-done change, finish it if tests pass, otherwise discard just that change (`git checkout -- <its files>`) and redo it.
     - `State: stopped (success)` / `stopped (plateau)` / `stopped (max)` / `parked` → Mikkel hasn't decided yet: go straight to "Show me" for that state. If he gave notes now, treat them as "Try with my notes".
     - `State: rejected` (branch kept) → ask him with AskUserQuestion: "Delete the old design-loop branch and start a new loop from main" / "Keep it and stop". On delete: `git checkout main`, `git branch -D design-loop`, `git push origin --delete design-loop`, then start a new loop.
   - New notes from Mikkel on a resume replace `Notes:` in the state block.

State block (keep it exactly like this, at the top of the loop section, updated and committed after every step):
```
State: running
Round: 3
Phase: build
Max rounds: 8
Best lowest: 7
Rounds without progress: 0
Confirming: no
Notes: none
```

## 1. Each round
Round N = `Round` + 1. Say "Round N" (one line) and update the state block.

### a) Bring in main (rounds after the first)
`git fetch origin && git merge origin/main`. Resolve trivial conflicts (IDEAS.md rows, docs) by keeping both sides; if a conflict touches code you don't understand, set `State: parked`, commit, push, and stop with a plain-language explanation.

### b) REVIEW (blind)
1. `npm run build`. Delete earlier review folders (`design-review/blind-*`) so reviewers can't compare. Shots go to a neutral folder named after the commit: `<shots>` = `design-review/blind-<git rev-parse --short HEAD>`.
2. `npm run design:shots -- <shots>` and `npm run design:motion -- <shots>`.
3. Start **design-colour, design-typography, design-motion, design-layout and design-overall** in one message (five Agent calls, in parallel), each a **fresh** subagent (never SendMessage to an earlier one). Give each only this neutral instruction, with nothing added:
   > Review the current app in your area and score it honestly. Screenshots: `<shots>` (motion frames in `<shots>/motion`). Report only: don't edit app files or commit. Use your own port for any extra shots.
   If Mikkel gave notes about **where to look** (e.g. "focus on the session screen"), you may add: "Cover <that> first and most thoroughly." Never mention a target score, a loop, a round, earlier scores, earlier reviews or what was changed. Never let them read `DESIGN_LOOP.md` or `DESIGN_SCORES.md` (their agent files already forbid it; don't grant permission).
4. Don't write anything about the loop where reviewers look: no loop/round/score mentions in code comments, CSS, `DECISIONS.md`, `ARCHITECTURE.md` or `CLAUDE.md` while the loop runs (`DESIGN_LOOP.md` and commit messages are fine; reviewers don't read them).

### c) LOG the scores
Add the round's row to the scores table and a `### Round N` subsection: the five scores with a one-line reason each, and the 3 weakest points per reviewer in one line each. Then apply the stopping rules (section 2) **before** building. Commit (`Design loop: round N scores`) and push.

### d) DECIDE (only you know the goal)
Pick **1–3 changes** most likely to raise the **lowest** score(s) without lowering the others, from the reviewers' proposals and your own judgement. Rules:
- Never break a deliberate choice in `DECISIONS.md` or CLAUDE.md, and never remove, hide or change how a learning feature works (exercises, grading, FSRS, Tone Gym, audio, Reading, stats content, mic toggles, hanzi off by default in listening, tone-colour meanings). Design only: colour, type, spacing, layout, motion, visual polish, copy tone.
- Don't retry a change that an earlier round of this loop tried and that didn't help (check `DESIGN_LOOP.md`), and don't undo a previous round's change unless reviewers clearly say it hurt.
- Changes must work together (palette + type + spacing + motion as one language).
Write the plan in the round's subsection as a checklist (`- [ ] <title>: what, where, which score it targets`). Commit and push.

### e) BUILD (one change at a time, on design-loop)
For each planned change:
1. Implement it cleanly (ARCHITECTURE.md style; both themes, both widths, `prefers-reduced-motion`).
2. `npm test` and `npm run build` until both pass; update tests if labels or behaviour changed.
3. Commit **only that change** (`Design loop: <title>`) so it can be reverted on its own, tick it in the plan with the short commit hash, update the state block, commit the log (or include it in the same commit) and `git push`.
If a change can't be made to pass tests, revert it, note "dropped (why)" in the plan and move on.

Then **one qa run per round** (Mikkel, 2026-11-07: saves the wait after every change): run the **qa** subagent once, after the round's last change, listing every change (in plain design terms, no loop/score talk) and **only the screens those changes touch**; tell it to use `npm run qa:screens` plus at most a few targeted extra shots, and to keep it short. Fix anything it finds (review its own small fixes) in a separate commit (`Design loop: QA fixes`), or revert the change that caused it and mark it "dropped (why)"; re-run `npm test` and the build, then push.

### f) Next round
Set `Phase: review`, commit, push, and start the next round.

## 2. Stopping rules (check after logging each round's scores)
Lowest = the lowest of the five scores this round.
- **SUCCESS:** all five ≥ 9.
  - If `Confirming: no` → set `Confirming: yes`, skip DECIDE/BUILD, and run a **confirmation round** right away (fresh reviewers, same blind instruction, same build).
  - If `Confirming: yes` and all five ≥ 9 again → `State: stopped (success)`, commit, push, go to "Show me".
  - If the confirmation round has any score < 9 → `Confirming: no` and continue normally with DECIDE/BUILD in this round.
- **PLATEAU:** if Lowest > `Best lowest`, set `Best lowest` = Lowest and `Rounds without progress: 0`; otherwise add 1. When it reaches **2** → `State: stopped (plateau)`.
- **MAX:** after round `Max rounds` (8) is logged without success → `State: stopped (max)`.
- **Usage running out:** you can't know in advance, so the loop is always resumable: commit and push after every step (scores logged, plan written, each change built). If you notice you are being cut short, make sure the latest state is committed and pushed. The next `/design-loop` resumes from `DESIGN_LOOP.md`.

## 3. Show me (only when the loop has stopped)

### On SUCCESS
1. `<final>` = `design-review/<date>-final` (git-ignored).
2. After (design-loop): `npm run build`, then `npx tsx scripts/design-preview.ts shots <final>/after`.
3. Before (main): `npx tsx scripts/design-preview.ts worktree final-main origin/main`, `npx tsx scripts/design-preview.ts build final-main`, `npx tsx scripts/design-preview.ts shots <final>/before --dir .design-worktrees/final-main`, then `npx tsx scripts/design-preview.ts remove final-main`.
4. `npx tsx scripts/design-preview.ts compare <final> "Design loop: before (main) and after (design-loop)"`, then open the page for him: PowerShell `Invoke-Item "<final>\compare.html"`. **Only changed pages** (Mikkel, 2026-11-07): `compare` leaves out identical before/after pairs; if a pair differs only by noise (no visible change from the loop), delete that pair's before/after files and re-run `compare`. Never show him unchanged pages.
5. In the chat: scores per round (the table), and a short plain-language list of **every change**: `<short hash> <title>`: what he'll notice, one line each (from `git log --oneline main..design-loop`, leaving out the log-only commits).
6. AskUserQuestion: "The design loop reached 9+ from all five reviewers twice. Before/after: <full path to compare.html>. What should go live?" Options: **Approve all** ("Merge every change into main and publish it"), **Let me pick changes** ("Keep or drop each change"), **Reject all** ("Nothing goes live; the branch is kept for now").
   - **Let me pick:** one question per change, max 4 per call (more rounds of questions as needed): `<hash> <title>: <one line>`, header `Change n`, options **Keep** / **Drop**. Revert the dropped ones on design-loop, newest first (`git revert --no-edit <hash>`; resolve conflicts carefully), then `npm test`, `npm run build` and the **qa** subagent on the affected screens; fix what it finds; commit and push the branch. If every change was dropped, treat it as Reject all.
   - **Approve all / after picking:** merge into main:
     1. `git checkout main && git pull --rebase`, `git merge --no-ff design-loop -m "Design loop <k>: <n> changes (all reviewers 9+)"`. On a conflict you can't resolve safely, abort the merge, stop and explain.
     2. `npm test` and `npm run build` on main; fix until both pass.
     3. Record it: a dated entry in `DECISIONS.md` listing the kept changes (so future reviews don't undo them), and a section at the top of `## Reviews` in `DESIGN_SCORES.md` with the final round's five scores and reasons, plus a row in its Score history; mark the loop `State: merged` in `DESIGN_LOOP.md`.
     4. Commit and `git push` main (the app goes live), then delete the merged branch: `git branch -d design-loop && git push origin --delete design-loop`.
   - **Reject all:** set `State: rejected` on design-loop, commit, push, `git checkout main`, then AskUserQuestion: "Delete the design-loop branch?" **Delete** (`git branch -D design-loop`, `git push origin --delete design-loop`) / **Keep it** (leave it; the next /design-loop asks again).

### On PLATEAU or MAX
Don't show screenshots or proposals. In the chat: the scores per round (the table), which reviewer held the lowest score, where it got stuck and why (what was tried for it and what the reviewers kept saying), in plain language. Then AskUserQuestion: "The design loop stopped (<plateau/max>) at lowest score N. What next?" Options:
- **Continue 3 more rounds** → `Max rounds` + 3, `Rounds without progress: 0`, `State: running`; go back to section 1.
- **Try with my notes** → ask him in the chat for his notes, wait for his reply, store them in `Notes:`, reset as above and continue (notes guide your DECIDE step; only their "where to look" part goes to reviewers).
- **Stop** → `State: parked`, commit and push the branch, `git checkout main`. Nothing goes live; the next /design-loop picks it up from here.

## 4. Always at the end
Commit and push whatever branch you're on, then `git checkout main` so his next session starts on main, and check `git status` is clean. End with a short plain-language summary: why it stopped, the scores, what (if anything) went live, and what's waiting.
