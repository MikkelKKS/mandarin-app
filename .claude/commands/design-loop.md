---
description: Autonomous design loop on the design-loop branch. An Opus art director sets a direction, two blind reviewers score five areas, a blind judge keeps only changes that really look better; repeat until all five areas are 9+ twice. Then Mikkel sees before/after and decides what goes live
argument-hint: "[your notes, e.g. focus on the session screen]"
model: claude-opus-5-5
effort: medium
---

Run the autonomous design loop. Mikkel's notes (may be empty): $ARGUMENTS

**Runs on its own:** never ask Mikkel anything and never show him screenshots or proposals until the loop **stops** (see "Stopping rules"). Exceptions to CLAUDE.md for this command: loop work is committed to the **`design-loop` branch, never to main** (only the final merge he approves goes to main), and you don't ask before pushing the branch.

## Who does what (lineup chosen by Mikkel, 2026-11-07, to save his 5-hour limit)
- **design-visual** (sonnet): scores colour, typography and layout against fixed checklists.
- **design-experience** (sonnet): scores motion and overall, walking a user's day through the shots and motion frames.
- **design-director** (opus, Mikkel's one exception): writes `DESIGN_DIRECTION.md` and a build plan. Runs in round 1 and again only when the loop stalls.
- **design-judge** (sonnet): blind A/B pairs, once per round, decides which changes stay.
- **qa** (sonnet): once per round, only the screens the round touched.
- **You** (main session, Opus 5.5, medium): plan, build, decode the judge, log. Building is never handed to a subagent. Load the **frontend-design** skill (`frontend-design:frontend-design`) once per session before building, and follow it together with `DESIGN_DIRECTION.md`.
That's 2 reviewers + 1 judge + 1 QA per round (+ the director in round 1). Never spawn more without a reason written in the log. No paid APIs or services. Browsers are always headless and muted (`e2e/launch.ts`); only use the npm scripts, configs and `scripts/design-preview.ts`.

**The goal (only you know it):** in one round all five areas score **9 or more**, and then a confirmation round with fresh reviewers does too.

**What may change** (Mikkel, 2026-11-07; details in DECISIONS.md "Design freedoms"): the look as a whole (palette, fonts, game feel), Home and Stats layouts, the volume slider's form, the answer-panel scroll (the right answer must stay visible), whole-screen redesigns, and new features or content that serve the design. **Protected:** how learning works (exercises, grading, FSRS, Tone Gym logic, audio, Reading, mic toggles), hanzi off by default in listening, the tone-colour meanings, the Quick-on-phone / Deep-on-PC swap. A change to how learning works goes to IDEAS.md as `proposed` instead.

**Deploys:** the app only deploys from main (`.github/workflows/deploy.yml`). Pushing `design-loop` never puts anything live.

## 0. Start or resume
1. Make a to-do list (start/resume, then one item per round as you go, then "Show Mikkel") and keep it updated.
2. If `git status` shows uncommitted changes that aren't from an interrupted loop change, stop and explain simply (don't stash or discard his work). `git checkout main && git pull --rebase` (on conflict: stop and explain). If `node_modules` is missing, `npm install`. Remove leftover preview worktrees (`git worktree list`; `npx tsx scripts/design-preview.ts remove <name>`).
3. `git fetch origin`, then `git branch -a --list '*design-loop'`.
   - **No branch → new loop.** `git checkout -b design-loop main`. In `DESIGN_LOOP.md` add `## Loop <k> (started <date>)` with the state block below (`State: running`, `Round: 0`, `Phase: review`, `Max rounds: 8`, `Best lowest: –`, `Rounds without improvement: 0`, `Confirming: no`, `Notes:` his notes or "none"), then the table `| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |`. Commit (`Design loop <k>: start`), `git push -u origin design-loop`.
   - **Branch exists → resume.** `git checkout design-loop && git pull --rebase`, read the last `## Loop` section of `DESIGN_LOOP.md` (the loop's memory; reviewers never see it):
     - `State: running` → continue at the next unfinished step of the current round (unchecked plan items are still to build; a round without scores starts at REVIEW). A half-done change in the working tree: finish it if tests pass, otherwise `git checkout -- <its files>` and redo it.
     - `stopped (success)` / `stopped (plateau)` / `stopped (max)` / `parked` → go straight to "Show me" for that state. New notes from him count as "Try with my notes".
     - `State: rejected` (branch kept) → AskUserQuestion: "Delete the old design-loop branch and start a new loop from main" / "Keep it and stop". On delete: `git checkout main`, `git branch -D design-loop`, `git push origin --delete design-loop`, then start a new loop.
   - New notes on a resume replace `Notes:`.

State block (exactly this shape, at the top of the loop section; the status line reads it; update and commit it after every step):
```
State: running
Round: 3
Phase: build
Max rounds: 8
Best lowest: 7
Rounds without improvement: 0
Confirming: no
Notes: none
```
Phases: `review` → `direct` (round 1 or stalled) → `build` → `judge` → `qa` → next round.

## 1. Each round
Round N = `Round` + 1. Say "Round N" (one line) and update the state block.

### a) Bring in main (rounds after the first)
`git fetch origin && git merge origin/main`. Trivial conflicts (IDEAS.md rows, docs): keep both sides. A conflict in code you don't understand: `State: parked`, commit, push, stop with a plain explanation.

### b) REVIEW (blind)
1. `npm run build`. Delete earlier blind folders (`design-review/blind-*`). `<shots>` = `design-review/blind-<git rev-parse --short HEAD>`.
2. `npm run design:shots -- <shots>` and `npm run design:motion -- <shots>` (lived-in profile plus `home-new`/`stats-new`; see `qa/design.spec.ts`).
3. Start **design-visual** and **design-experience** in one message (two Agent calls, parallel), each **fresh** (never SendMessage to an earlier one), with only this instruction:
   > Review the current app in your area and score it honestly against your checklists. Screenshots: `<shots>` (motion frames in `<shots>/motion`). Report only: don't edit app files or commit. Use your own port for any extra shots.
   If Mikkel's notes say where to look, add "Cover <that> first and most thoroughly." Never mention a target, a loop, a round, earlier scores or what changed.
4. Nothing about the loop goes where reviewers look: no loop/round/score talk in code comments, CSS, `DECISIONS.md`, `ARCHITECTURE.md`, `CLAUDE.md` or `DESIGN_DIRECTION.md` (`DESIGN_LOOP.md` and commit messages are fine).

### c) LOG the scores, then check the stopping rules (section 2)
Add the round's row (the five scores; Lowest; Note = last round's judge result, e.g. "judge: 3 kept, 1 reverted") and a `### Round N` subsection: the five scores with the failed checklist items, and the reviewers' weakest points, one line each. Apply section 2 **before** building. Commit (`Design loop: round N scores`) and push.

### d) DIRECT (round 1, and when stalled)
Run **design-director** in round 1, and again when `Rounds without improvement` reaches 1 (the plan isn't working) or the director's plan is used up. Give it: `<shots>`, both reviewers' full reports, Mikkel's notes, and (from round 2 on) a short plain summary of what was built and what the judge kept or reverted, with no scores. It writes `DESIGN_DIRECTION.md` and returns a build plan. Commit the direction (`Design loop: direction`); its file must not mention scores or the loop.

### e) PLAN
Pick **the next 1–3 coherent moves**: from the director's plan first, then the reviewers' improvements that fit the direction, aimed at the lowest scores and the failed checklist items. Whole-screen redesigns and new presentation of existing data are fine. Don't retry a move the judge reverted unless it's clearly a different execution. Write the plan in the round's subsection as a checklist (`- [ ] <title>: what, where, which area/items it targets, screens affected`). Commit and push.

### f) BUILD (one move at a time, on design-loop)
For each planned move:
1. Implement it cleanly (ARCHITECTURE.md style; both themes, both widths, `prefers-reduced-motion`; the frontend-design skill's quality floor). Update `DECISIONS.md` only at merge time, not now.
2. `npm test` and `npm run build` until both pass; update tests if labels or behaviour changed.
3. Commit **only that move** (`Design loop: <title>`) so it can be dropped on its own, tick it with the short hash, update the state block, push.
A move that can't pass tests: revert, mark "dropped (why)", go on.

### g) JUDGE (one design-judge per round)
1. `npm run build`; `<after>` = `design-review/round-N-after`: `npx tsx scripts/design-preview.ts shots <after> <screens>` and, if the round changed motion, `npx tsx scripts/design-preview.ts motion <after>`. `<before>` = this round's `<shots>` folder (taken before building).
2. `npx tsx scripts/design-preview.ts pairs <before> <after> design-review/pairs-N --only <prefixes>` with the affected screens in **phone light, PC light and phone dark** (and the affected motion interactions, phone full), at most ~12 screens so the judge stays cheap.
3. Start a fresh **design-judge** with: "Compare the pairs in `design-review/pairs-N`. Report only."
4. Decode with `design-review/keys/pairs-N.json` (each screen appears twice, once per side). Per screen: **better** if the after-side won both times (or won once with the other "same"), **worse** if the before-side did, else **same**. Per move: keep it if its screens are better or same with at least one better; **revert** it (`git revert --no-edit <hash>`) if any of its screens is worse or all are same. A broken screen always means fix or revert. Log the per-screen results and kept/reverted moves in the round's subsection.
5. If nothing was kept, add 1 to `Rounds without improvement`; else set it to 0.

### h) QA (once per round)
Run the **qa** subagent once: list every kept move in plain design terms (no loop/score talk) and **only the screens they touch**; tell it to use `npm run qa:screens` plus a few targeted extra shots and keep it short. Fix what it finds (review its small fixes) in one commit (`Design loop: QA fixes`) or revert the cause; `npm test`, build, push.

### i) Next round
Set `Phase: review`, commit, push, start the next round.

## 2. Stopping rules (after logging each round's scores)
- **SUCCESS:** all five ≥ 9.
  - `Confirming: no` → set `Confirming: yes`, skip DIRECT/PLAN/BUILD/JUDGE, run a **confirmation round** at once (fresh reviewers, same instruction, same build).
  - `Confirming: yes` and all five ≥ 9 again → `State: stopped (success)`, commit, push, "Show me".
  - Confirmation with any score < 9 → `Confirming: no`, continue normally in this round.
- Keep `Best lowest` up to date (the highest Lowest so far) for the record.
- **PLATEAU:** `Rounds without improvement` reaches **2** (the judge kept nothing in two rounds in a row, even after a new direction) → `State: stopped (plateau)`.
- **MAX:** round `Max rounds` (8) logged without success → `State: stopped (max)`.
- **Usage running out:** you can't know in advance, so commit and push after every step; the next `/design-loop` resumes from `DESIGN_LOOP.md`.

## 3. Show me (only when the loop has stopped)

### On SUCCESS
1. `<final>` = `design-review/<date>-final` (git-ignored).
2. After (design-loop): `npm run build`, `npx tsx scripts/design-preview.ts shots <final>/after`.
3. Before (main): `npx tsx scripts/design-preview.ts worktree final-main origin/main`, `... build final-main`, `... shots <final>/before --dir .design-worktrees/final-main`, `... remove final-main`.
4. `npx tsx scripts/design-preview.ts compare <final> "Design loop: before (main) and after (design-loop)"`, then open it: PowerShell `Invoke-Item "<final>\compare.html"`. **Only changed pages** (Mikkel, 2026-11-07): `compare` leaves out identical pairs; if a pair differs only by noise, delete its files and re-run `compare`.
5. In the chat: the score table, and every kept move in plain language: `<short hash> <title>: what he'll notice` (from `git log --oneline main..design-loop`, leaving out log-only, revert and reverted commits).
6. AskUserQuestion: "The design loop reached 9+ in all five areas twice. Before/after: <full path to compare.html>. What should go live?" **Approve all** / **Let me pick changes** / **Reject all**.
   - **Let me pick:** one question per move (max 4 per call): `<hash> <title>: <one line>`, header `Change n`, **Keep** / **Drop**. Revert dropped ones newest first, `npm test`, build, one **qa** run on the affected screens, fix, commit, push. All dropped = Reject all.
   - **Approve all / after picking:** `git checkout main && git pull --rebase`, `git merge --no-ff design-loop -m "Design loop <k>: <n> changes (all areas 9+)"` (unresolvable conflict: abort, stop, explain); `npm test` and build on main; record a dated entry in `DECISIONS.md` listing the kept moves and the direction (so future reviews don't undo them), a section at the top of `## Reviews` in `DESIGN_SCORES.md` (final scores and reasons) plus a Score history row, `State: merged` in `DESIGN_LOOP.md`; commit, `git push` (goes live), `git branch -d design-loop && git push origin --delete design-loop`.
   - **Reject all:** `State: rejected`, commit, push, `git checkout main`, then AskUserQuestion "Delete the design-loop branch?" **Delete** / **Keep it**.

### On PLATEAU or MAX
In the chat: the score table, what the judge kept and reverted per round, which area held the lowest score and why it stuck, in plain language. Then AskUserQuestion: "The design loop stopped (<plateau/max>) at lowest score N. What next?"
- **See the before/after** → run the SUCCESS steps 1–5 and the same three options (Approve all / Let me pick / Reject all).
- **Continue 3 more rounds** → `Max rounds` + 3, `Rounds without improvement: 0`, `State: running`, back to section 1 (with a fresh direction).
- **Try with my notes** → ask for his notes in the chat, store them in `Notes:`, reset as above, continue.
- **Stop** → `State: parked`, commit, push, `git checkout main`. Nothing goes live.

## 4. Always at the end
Commit and push whatever branch you're on, `git checkout main`, check `git status` is clean. End with a short plain summary: why it stopped, the scores, what (if anything) went live, and what's waiting.
