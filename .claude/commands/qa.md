---
description: Run the QA agent on its own (screenshots at phone and PC width, fix small issues, log bigger ones)
---

1. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Run the **qa** subagent. Focus: $ARGUMENTS (if empty: all main screens plus whatever changed in the last 5 commits).
3. If it changed any files: run `npm test`, then commit (`QA fixes`) and push to main.
4. Tell Mikkel in plain language what was checked, what was fixed, and which bugs were added to IDEAS.md.
