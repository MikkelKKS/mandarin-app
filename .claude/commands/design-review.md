---
description: One round of the design loop. Mikkel picks one of 2–3 previewed directions, one round of bold moves is built, judged blind and QA'd on the design-loop branch, and he sees before/after and decides what goes live
argument-hint: "[your notes, e.g. focus on the PC session, or keep the current direction]"
model: claude-opus-5-5
effort: medium
---

Run a design review. Mikkel's notes (may be empty): $ARGUMENTS

A design review is **exactly the design loop with one round** (Mikkel, 2026-11-07). Read `.claude/commands/design-loop.md` now and follow it step by step, with only these differences:

- **Max rounds: 1.** Set `Max rounds: 1` in the new loop section (his notes can't raise it here; for more rounds he runs `/design-loop`).
- The loop section in `DESIGN_LOOP.md` is titled `## Review <date> (loop <k>)`, so the log shows it was a review.
- If a `design-loop` branch already exists (a loop or review in progress), don't start a second one: resume it as `/design-loop` would.
- Everything else is the same: the same team, the same direction choice at the start (section 1; he may answer "Keep the current direction"), one round of one or two bold moves (section 2, starting at 2e), the blind judge, one qa run, the final review for the record, the baseline judge, the before/after page with only changed screens, and his choice at the end (Approve all / Let me pick / Reject all / Continue 2 more rounds, which turns it into a loop).
