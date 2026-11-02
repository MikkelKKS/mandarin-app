---
description: Build every idea marked "approved" in IDEAS.md, one at a time, with tests and QA after each
---

Build the approved ideas in `IDEAS.md`. Optional (only these IDs): $ARGUMENTS

1. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Find the rows in IDEAS.md with status `approved` (any capitalisation). If there are none, tell Mikkel how to approve ideas and stop.
3. For **each** approved idea, in ID order, one at a time:
   a. Set its status to `building`. Do the build work yourself in this main session (never hand it to a subagent), following CLAUDE.md, ARCHITECTURE.md and the existing code style. If the idea is ambiguous in a way that changes what you build, ask Mikkel one short question.
   b. Add or update unit tests (`src/**/*.test.ts`) and, for new screens or flows, an `e2e/` spec.
   c. Run `npm test` and `npm run build`. Fix until both pass.
   d. Run the **qa** subagent, telling it what the idea was and what you changed. Review its small fixes; re-run `npm test` if it changed code.
   e. Record notable choices in DECISIONS.md (dated heading) and update ARCHITECTURE.md if the structure changed.
   f. Set the idea's status to `done` (bug rows QA added stay `bug`).
   g. Commit (`<Idea title> (IDEAS #<id>)`) and push to main before starting the next idea.
4. Finish with a plain-language summary for Mikkel: what each idea now looks like in the app and where to find it, any bugs QA logged, and anything he needs to do (step by step).

If tests can't be made to pass for an idea, revert that idea's changes, set its status back to `approved` with a short note in the Why column, and move on.
