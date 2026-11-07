---
description: Design loop on the design-loop branch. Mikkel picks one of 2–3 previewed directions, then it runs on its own - bold whole-screen moves, two blind reviewers that count failed checklist items, a blind A/B judge that keeps only what really looks better - and shows him before/after at the end
argument-hint: "[your notes, e.g. 3 rounds, focus on the PC session]"
model: claude-opus-5-5
effort: medium
---

Run the design loop. Mikkel's notes (may be empty): $ARGUMENTS

**Asks Mikkel twice:** once at the start to pick a direction (section 1), and once when the loop stops. Between those it runs on its own. Loop work is committed to the **`design-loop` branch, never to main** (only the final merge he approves goes to main); pushing the branch needs no question.

## Who does what (Mikkel, 2026-11-07; lean, to save his 5-hour limit)
- **design-director** (opus, Mikkel's one exception): at the start, 2–3 clearly different directions; later, a revised plan only when the loop stalls.
- **design-visual** (sonnet): colour, typography, layout. **design-experience** (sonnet): motion, overall. Both score 1–10 **and count failed checklist items**, on the fixed key-screen list below.
- **design-judge** (sonnet): blind A/B pairs in both orders, once per round, plus once at the end against the loop's starting point.
- **qa** (sonnet): once per round, only the screens the round touched.
- **You** (main session, Opus 5.5, medium): previews, building, decoding, logging. Building is never handed to a subagent. Load the **frontend-design** skill (`frontend-design:frontend-design`) once per session before building and follow it with `DESIGN_DIRECTION.md`.
Never spawn more agents than this without a reason written in the log. No paid APIs. Browsers are always headless and muted (`e2e/launch.ts`); only the npm scripts, configs and `scripts/design-preview.ts`.

**What may change** (DECISIONS.md "Design freedoms"): the whole look (palette, fonts, a display face, illustration, game feel, a signature motion), every screen's layout including whole-screen redesigns, the volume control, the answer-panel behaviour (the right answer must stay visible), and new features or content that serve the design. **Protected:** how learning works (exercises, grading, FSRS, Tone Gym logic, audio, Reading, mic toggles), hanzi off by default in listening, the tone-colour meanings (1 red, 2 orange, 3 green, 4 blue, neutral grey), the Quick-on-phone / Deep-on-PC swap, the 学 logo. A change to how learning works goes to IDEAS.md as `proposed`.

**Key screens** (reviewers open all of them; the judge's pairs come from them): phone light: home, home-new, session-question, session-wrong, session-right, session-end, tone-gym, tone-gym-question, stats, settings, library · PC light: home, session-question, session-wrong, stats, tone-gym, settings · phone dark: home, session-wrong, stats · motion (phone full): answer-right, answer-wrong, next-question, page-transition; phone reduced: answer-wrong.

**Goal and how progress is measured.** 1–10 scores from fresh reviewers barely move (they cluster at 7–8), so they are the record, not the target. Progress is: (1) the **round judge** keeps moves, (2) the **failed-item count** goes down, and (3) at the end the **baseline judge** (loop start vs loop end, key screens) prefers the end. Early stop on success only if all five areas are 9+ twice (rare).

**Deploys:** only main deploys. Pushing `design-loop` never puts anything live.

## 0. Start or resume
1. To-do list (start/resume, direction, one item per round, show Mikkel); keep it updated.
2. Uncommitted changes that aren't from an interrupted loop change: stop and explain. `git checkout main && git pull --rebase` (conflict: stop and explain). `npm install` if `node_modules` is missing. Remove leftover preview worktrees.
3. `git fetch origin`; `git branch -a --list '*design-loop'`.
   - **No branch → new loop.** `git checkout -b design-loop main`. In `DESIGN_LOOP.md` add `## Loop <k> (started <date>)` with the state block (`State: running`, `Round: 0`, `Phase: direct`, `Max rounds:` from his notes, default **4**, `Best lowest: –`, `Rounds without improvement: 0`, `Confirming: no`, `Baseline: <short hash of main>`, `Notes:`), and the table `| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |`. Commit (`Design loop <k>: start`), `git push -u origin design-loop`.
   - **Branch exists → resume** from the last `## Loop` section: `running` → the next unfinished step; `stopped (…)`/`parked` → "Show me"; `rejected` → AskUserQuestion: delete the branch and start fresh / keep it and stop.

State block (exact shape; the status line reads it; update and commit after every step):
```
State: running
Round: 2
Phase: build
Max rounds: 4
Best lowest: 7
Rounds without improvement: 0
Confirming: no
Baseline: 1a2b3c4d5
Notes: none
```
Phases: `direct` → `review` → `build` → `judge` → `qa` → next round; at the end `final`.

## 1. Direction (new loop only; asks Mikkel)
1. `npm run build`; `<shots>` = `design-review/blind-<short HEAD>`; `npm run design:shots -- <shots>` and `npm run design:motion -- <shots>`.
2. Run **design-visual** and **design-experience** (fresh, parallel) with the blind instruction from 2b below. Log their scores and failed-item counts as round 0 (the baseline).
3. Run **design-director** with `<shots>`, both reports and his notes, asking for **2–3 clearly different directions** (not variations): each a concept, palette/type tokens, the treatment of Home and the session screen, and the first 2–4 moves. One may be "evolve the current direction"; at least one must be bold (e.g. a display face, illustration, a new layout system). It writes them to `DESIGN_DIRECTIONS.md` (temporary, deleted after the choice).
4. Preview each direction (A, B, C) in a worktree from HEAD (`npx tsx scripts/design-preview.ts worktree dir-a`, …): build just enough to show **Home and a session question** faithfully (tokens + those two screens), `build`, `shots design-review/directions/<x>/after home,session --dir .design-worktrees/dir-<x>`, `remove`. Copy the matching current shots into `design-review/directions/<x>/before`, then `compare design-review/directions/<x>` so he sees before | after, only changed pages.
5. AskUserQuestion: "Which design direction should the loop build?" One option per direction (a one-line concept and the full path to its compare.html), plus "Keep the current direction". If he answers with notes, store them in `Notes:` and follow them.
6. Write the chosen direction into `DESIGN_DIRECTION.md` (replace; no loop/score words), delete `DESIGN_DIRECTIONS.md`, commit (`Design loop: direction`), then start round 1 at **2e PLAN** (round 0's review stands in for round 1's).

## 2. Each round
Round N = `Round` + 1. Say "Round N".

### a) Bring in main (from round 2)
`git fetch origin && git merge origin/main`. Trivial conflicts: keep both. Code conflicts you don't understand: `State: parked`, commit, push, stop and explain.

### b) REVIEW (blind; skipped in round 1, which uses round 0's review)
1. `npm run build`; delete earlier `design-review/blind-*`; `<shots>` = `design-review/blind-<short HEAD>`; `npm run design:shots -- <shots>` and `npm run design:motion -- <shots>`.
2. **design-visual** and **design-experience** in one message, each fresh, with only:
   > Review the current app in your area and score it honestly against your checklists. Open every key screen listed in your instructions. Screenshots: `<shots>` (motion frames in `<shots>/motion`). Report only: don't edit app files or commit. Use your own port for any extra shots.
   Add "Cover <that> first" if his notes say where to look. Never mention targets, loops, rounds, earlier scores or what changed.
3. Nothing about the loop in code comments, CSS, `DECISIONS.md`, `ARCHITECTURE.md`, `CLAUDE.md` or `DESIGN_DIRECTION.md`.

### c) LOG and check the stopping rules (section 3)
Row: the five scores; Lowest; Note = failed items total and last round's judge result (e.g. "fails 17 (was 21) · judge 2 kept"). Subsection `### Round N`: scores with failed items, weakest points one line each. Commit and push.

### d) RE-DIRECT (only when stalled)
If `Rounds without improvement` is 1, run **design-director** for a revised plan within the chosen direction (give it the shots, both reports, and a plain summary of what was built and kept or reverted; no scores). Commit any `DESIGN_DIRECTION.md` change.

### e) PLAN
**One or two bold moves**, not a list of tweaks: each is a whole screen or a whole system done properly (e.g. "PC session as a two-pane workspace", "Settings rebuilt with sections and a jump bar", "a display face for all headings"), taken from the direction's plan first, aimed at the most failed checklist items. Don't retry a move the judge reverted unless it's clearly a different execution. Checklist in the round subsection: `- [ ] <title>: what, where, which failed items, screens and motion it touches`. Commit and push.

### f) BUILD (one move per commit)
1. Implement it fully (ARCHITECTURE.md style; both themes, both widths, reduced motion; the frontend-design skill's quality floor). Look at your own screenshots (`npx tsx scripts/design-preview.ts shots design-review/chk <screens>`) and fix what looks off before committing.
2. `npm test`, `npm run build`, and the e2e specs that touch the changed screens (`npx playwright test e2e/<spec>`); update tests if labels changed. Before the round ends, `npm run test:e2e` once: it's what the deploy runs, and a failing smoke test blocks every deploy.
3. Commit only that move (`Design loop: <title>`), tick it with the hash, update the state block, push.

### g) JUDGE (one design-judge)
1. Fair before shots: if anything under `qa/` changed this round, re-shoot `<before>` from the round's start commit in a worktree with the current `qa/` files copied in; otherwise `<before>` = this round's `<shots>`.
2. `<after>` = `design-review/round-N-after`: `shots` of the affected screens, and **always `motion`** when a move changes layout, sheets or anything that moves (a layout change can make content jump; stills don't show it).
3. `npx tsx scripts/design-preview.ts pairs <before> <after> design-review/pairs-N --only <prefixes>`: the affected key screens in phone light, PC light, phone dark, plus the affected motion folders; at most ~14.
4. Fresh **design-judge**: "Compare the pairs in `design-review/pairs-N`. Report only."
5. Decode with `design-review/keys/pairs-N.json`: per screen better / worse / same (better = after won both orders, or once with "same"). Keep a move whose screens are better or same with at least one better. If a screen is worse, find the part of the move that caused it: undo **that part** in its own commit if it's separable, otherwise revert the move. Log per screen and per move.
6. Nothing kept → `Rounds without improvement` + 1; else 0.

### h) QA (one qa run)
List every kept move in plain design terms (no loop talk) and only the screens they touch; `npm run qa:screens` plus a few targeted shots, short. Fix what it finds (one commit) or revert the cause; `npm test`, build, push.

### i) Next round
`Phase: review`, commit, push, next round.

## 3. Stopping rules (after logging a round)
- **SUCCESS (rare):** all five ≥ 9 → a confirmation round with fresh reviewers at once; ≥ 9 again → `State: stopped (success)`.
- **PLATEAU:** `Rounds without improvement` reaches 2 → `stopped (plateau)`.
- **MAX:** when round `Max rounds` is **built and judged**, run one last REVIEW for the record (2b–2c), then `stopped (max)`.
- Keep `Best lowest` for the record. Commit and push after every step, so a cut-off loop resumes.

## 4. Show me (when stopped)
1. **Baseline judge:** `npm run build`; `<final>` = `design-review/<date>-final`; `shots <final>/after`; worktree at `Baseline` with the current `qa/` copied in, `build`, `shots <final>/before --dir …`, `remove`. `pairs <final>/before <final>/after design-review/pairs-final --only <key screens>` and one fresh **design-judge**. Decode: how many key screens are better / same / worse than at the start.
2. `compare <final> "Design loop: before (main) and after (design-loop)"` (only changed pages; delete noise-only pairs and re-run), open it: PowerShell `Invoke-Item "<final>\compare.html"`.
3. In the chat: the score table with failed-item counts, the baseline judge result ("better on 15 of 18 key screens"), and every kept move in plain words: `<short hash> <title>: what he'll notice` (leave out log, revert and reverted commits).
4. AskUserQuestion: "The design loop stopped (<why>). Before/after: <full path>. What should go live?" **Approve all** / **Let me pick changes** / **Reject all** / **Continue 2 more rounds**.
   - **Let me pick:** one question per move (max 4 per call), **Keep** / **Drop**; revert dropped ones newest first, test, build, one qa run, push. All dropped = Reject all.
   - **Approve all / after picking:** `git checkout main && git pull --rebase`, `git merge --no-ff design-loop -m "Design loop <k>: <n> changes"`; `npm test`, `npm run build`, `npm run test:e2e`; a dated `DECISIONS.md` entry with the kept moves and the direction; a section at the top of `## Reviews` in `DESIGN_SCORES.md` plus a Score history row; `State: merged`; commit, push (goes live), delete the branch locally (`git branch -D` once merged) and on GitHub. Then check the `build-and-deploy` run for that commit finished green; if it failed, read its annotations, fix, push.
   - **Reject all:** `State: rejected`, commit, push, `git checkout main`, AskUserQuestion: delete the branch / keep it.
   - **Continue:** `Max rounds` + 2, `Rounds without improvement: 0`, `State: running`, back to section 2.

## 5. Always at the end
Commit and push the branch you're on, `git checkout main`, `git status` clean. A short plain summary: why it stopped, the scores and failed items, the baseline judge result, what went live, what's waiting.
