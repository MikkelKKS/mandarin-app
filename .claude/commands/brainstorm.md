---
description: Ask the idea panel (learning-expert, creative, critic) for new ideas and add the winners to IDEAS.md
---

Run the idea panel for this app. Optional focus topic: $ARGUMENTS

1. Make sure you are up to date: `git pull --rebase`. If it conflicts, stop and explain simply.
2. Launch the **learning-expert** and **creative** subagents in parallel. Tell each to read CLAUDE.md, DECISIONS.md, ARCHITECTURE.md and IDEAS.md and propose 3–5 new ideas (on the focus topic, if one was given).
3. Give the combined list to the **critic** subagent and ask for SUPPORT or REJECT on each idea.
4. Count votes, three voters per idea: the proposer (always supports its own idea), the other proposer, and the critic. Ask the other proposer's view only by judging whether the idea clearly serves its area (learning value for learning-expert, fun/motivation for creative); if unsure, it does not count as support. Keep only ideas with **at least two of the three** in support. Drop duplicates.
5. Add each winner as a new row in the Ideas table in `IDEAS.md`: next free ID, short title, status `proposed`, type `feature`, a one-line why, size S/M/L, source (`learning`, `creative` or both), today's date.
6. Commit (`Brainstorm: N new ideas`) and push to main.
7. **Open IDEAS.md for Mikkel** (only if this run added at least one new `proposed` row; skip it otherwise). Do this once, as the very last tool call, after the push: run `cmd.exe /c start "" IDEAS.md` with the **PowerShell** tool from the repo root (in the Bash tool, Git Bash mangles `/c`, so don't use that). It opens the file in his default editor.
8. Tell Mikkel in plain language: the winning ideas (one line each), how many were rejected and the main reasons, and remind him to change `proposed` to `approved` or `rejected` in IDEAS.md, then run /build.

Subagents use the model set in their own files; never use opus for a subagent.
