# Ideas

Improvement ideas for the app, from the idea panel (`/brainstorm`), polish reviews (`/polish`), QA (`/qa`) and you.

## How to use this (Mikkel)

1. Run **/brainstorm** for new feature ideas, or **/polish** to tidy up what already exists (you can add your own notes, e.g. `/polish the stats page feels cluttered`). New ideas appear in the table below with status `proposed`. /polish also fixes small, safe things straight away and only lists the bigger ones here.
2. Read them. Quickest: answer in the terminal. /brainstorm and /polish ask you at the end, and **/ideas** lists everything waiting for you; reply e.g. `approve 1 3, reject 2` and it updates the table for you. Or do it by hand: for each one, change the word in the **Status** column:
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
| 1 | Collapsible achievements on Stats | done | polish | Stats is ~12,000px tall on phone; 15 achievement cards fill the bottom half. Show the 3–4 closest and a "Show all" | M | ux-reviewer, qa | 2026-11-02 |
| 2 | Two-column Home on PC | done | polish | At 1440px Home is one ~600px column with lots of empty space; put the sessions and the Tone Gym/next-step list side by side | M | ux-reviewer, qa | 2026-11-02 |
| 3 | Tone-twin words in feedback | done | feature | When a typed or heard answer has the right syllable but the wrong tone, name and play the HSK word it turned into (买 mǎi "buy" vs 卖 mài "sell"), and collect these pairs in a "Twins" list on Stats: minimal-pair contrast on real words, aimed at his biggest weakness | M | learning | 2026-11-02 |
| 4 | Sandhi notes on sentences | done | feature | When a sentence contains a 3-3, 不 or 一 tone change, feedback shows the spoken form plus a one-line rule (reusing the Tone Gym's sandhi code); typed answers keep dictionary tones | S | learning | 2026-11-02 |
| 5 | Study calendar heatmap | done | feature | Calendar on Stats shading each day by daily-goal progress, marking streak-freeze days; tap a day for XP, minutes and accuracy. About 6 months on phone, a full year on PC | S | creative | 2026-11-02 |
