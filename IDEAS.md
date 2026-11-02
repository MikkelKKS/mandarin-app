# Ideas

Improvement ideas for the app, from the idea panel (`/brainstorm`), polish reviews (`/polish`), QA (`/qa`) and you.

## How to use this (Mikkel)

1. Run **/brainstorm** for new feature ideas, or **/polish** to tidy up what already exists (you can add your own notes, e.g. `/polish the stats page feels cluttered`). New ideas appear in the table below with status `proposed`. /polish also fixes small, safe things straight away and only lists the bigger ones here.
2. Read them. For each one, change the word in the **Status** column:
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
