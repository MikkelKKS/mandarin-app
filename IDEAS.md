# Ideas

Improvement ideas for the app, from the idea panel (`/brainstorm`), polish reviews (`/polish`), QA (`/qa`) and you.

## How to use this (Mikkel)

1. Run **/brainstorm** for new feature ideas, or **/polish** to tidy up what already exists (you can add your own notes, e.g. `/polish the stats page feels cluttered`). New ideas appear in the table below with status `proposed`. /polish also fixes small, safe things straight away and only lists the bigger ones here.
2. Read them. Quickest: run **/ideas**. It opens this file and lists everything waiting for you in the chat; reply e.g. `approve 1 3, reject 2` and it updates the table for you. Or do it by hand: for each one, change the word in the **Status** column:
   - `proposed` → `approved` if you want it built
   - `proposed` → `rejected` if you don't (it stays here so it isn't suggested again)
3. Save the file and run **/build**. Claude builds every `approved` idea, tests it, runs QA, pushes it and marks it `done`.

You can also add your own idea as a new row with status `approved`. Rows with status `bug` were found by QA; change them to `approved` to get them fixed.

Statuses: `proposed` · `approved` · `rejected` · `building` · `done` · `bug`
Type: `feature` (from /brainstorm) · `polish` (from /polish) · `bug` (from QA)
Size: **S** = an hour or two · **M** = about a day · **L** = several days

## Ideas

| ID | Title | Status | Type | Why | Size | Source | Added |
|----|-------|--------|------|-----|------|--------|-------|
| 1 | Collapsible achievements on Stats | proposed | polish | Stats is ~12,000px tall on phone; 15 achievement cards fill the bottom half. Show the 3–4 closest and a "Show all" | M | ux-reviewer, qa | 2026-11-02 |
| 2 | Two-column Home on PC | proposed | polish | At 1440px Home is one ~600px column with lots of empty space; put the sessions and the Tone Gym/next-step list side by side | M | ux-reviewer, qa | 2026-11-02 |
