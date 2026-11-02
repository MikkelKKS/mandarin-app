---
description: Polish the existing app. The ux-reviewer and qa agents list problems; small safe fixes are made directly, bigger ones go to IDEAS.md
argument-hint: "[your notes, e.g. the stats page feels cluttered]"
---

Polish the existing app (no new features). Mikkel's notes: $ARGUMENTS

1. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Make a to-do list for these steps and keep it updated.
3. **Review.** Run the **ux-reviewer** and **qa** subagents in parallel. If Mikkel gave notes, tell both to focus on those first, then the rest of the app. Tell qa to only report this time (no fixes), so the two don't edit the same files.
4. **Sort.** Merge the two lists and drop duplicates. Drop anything that undoes a deliberate choice in DECISIONS.md.
   - **S (fix now):** small and safe (a few lines), doesn't change how a feature works.
   - **M/L (ask first):** bigger, or changes how a feature works.
5. **Fix the S items yourself**, one at a time. Say "Fix X of Y: <title>" before each and give a one-line status after it. Then run `npm test` and `npm run build` until both pass.
6. Run the **qa** subagent again on the screens you touched, to check the fixes. Fix anything small it finds.
7. Add every M/L item to the Ideas table in `IDEAS.md`: next free ID, title, status `proposed`, type `polish`, a one-line why, size, source `ux-reviewer` or `qa`, today's date.
8. Commit (`Polish: N fixes, M ideas`) and push to main.
9. **Ask in the chat** (only if this run added at least one new `proposed` row): never open IDEAS.md in an editor. In the final message, list the new ideas numbered by their ID and end with: "Reply e.g. `approve 1 3, reject 2` (or `approve all`)." When he replies, change only those rows' Status to `approved` or `rejected`, commit (`Ideas: approved X, rejected Y`), push, and say in one line what changed and that `/build` will build the approved ones.
10. End with a short plain-language list: **Fixed** (one line each) and **Waiting for your approval** (ID and title), then the reply line from step 9.
