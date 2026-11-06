# Design scores

Scorecards from `/design-review`. Five strict reviewers (colour, typography, motion, layout, overall) score the app 1–10:
1–3 broken or ugly · 4–5 works but amateurish · 6–7 solid but generic · 8 polished · 9 would stand next to Duolingo/Linear · 10 nothing to improve.

Each review adds a section below (newest first) with the scores, a one-line reason each, and what happened to every proposal (built, rejected, decide later). Reviewers read the latest section and don't re-propose rejected ideas without a new reason.

## Score history

| Date | Colour | Typography | Motion | Layout | Overall |
|------|--------|------------|--------|--------|---------|
| 2026-11-06 | 7 | 7 | 6.5 | 6 | 6.5 |
| 2026-11-06 (design loop 1, round 4) | 7.5 | 7 | 7 | 7 | 7 |

## Reviews

## 2026-11-06: design loop 1 (merged)
Notes: at most 4 rounds. Blind reviewers each round; log in `DESIGN_LOOP.md`. Stopped at the round limit (lowest 6.5 → 7); Mikkel approved all 9 changes.

| Area | Score | Reason (final round) |
|------|-------|--------|
| Colour | 7.5/10 | Disciplined palette, nearly all AA; T2 orange close to gold, dark feedback sheets flat |
| Typography | 7/10 | Short deliberate scale and strong pinyin hero; Stats small text and card titles still too uniform |
| Motion | 7/10 | Coherent tokens, stagger and exits; right vs wrong still mainly colour, reduced motion snaps |
| Layout | 7/10 | One main action, consistent cards; PC content edge differs per tab (P5-type, rejected) |
| Overall | 7/10 | Clean and coherent but restrained; seal personality appears once, progress understated |

Built (all kept): sheet without the page jump · sheet that enters in steps and leaves · readable tone colours and edges (IDEAS #24) · one type scale · bigger consistent pinyin · right answers lead with their reward · faster answer reaction · answer sheet with clear roles · Stats numbers that read as data.

## 2026-11-06
Notes: none

| Area | Score | Reason |
|------|-------|--------|
| Colour | 7/10 | Coherent porcelain/ink/jade palette and a real dark mode, but tone colours and gold text fail WCAG AA on light surfaces and controls have almost no edge |
| Typography | 7/10 | Instrument Sans has character and tone marks render well, but the exercise pinyin was small and sizes drifted (13/14/15/17px) without a scale |
| Motion | 6.5/10 | One consistent ease-out curve and working reduced motion, but right and wrong answers felt alike and the page jumped when the feedback sheet opened |
| Layout | 6/10 | Clean cards and a sensible PC sidebar, but empty space on PC, a ~12,000px single-column Stats page and uneven gaps on phone Home |
| Overall | 6.5/10 | Solid and coherent with personality at the edges (seal, tone colours), but reward moments are muted and Stats read like a form |

| # | Proposal | Area | Size | Decision |
|---|----------|------|------|----------|
| P1 | Readable tone colours and gold on light backgrounds, visible edges on answer options and audio buttons | colour | S | decide later (IDEAS #24) |
| P2 | Clearer right and wrong feedback (coloured titles with drawn tick/cross, spring pop, stronger shake, right option lit after a wrong pick, smooth scroll) | motion, colour | M | built |
| P3 | Pinyin as the star of exercises; fonts served by the app (Fontsource) instead of Google Fonts | typography | M | built |
| P4 | Stats grouped (Words / Tones / Habits / Scheduler & badges) with a jump bar, two columns on PC | layout, overall | M | built |
| P5 | Even 16px rhythm on Home, aligned cards, pill-style "No mic" button, Tone Gym side by side on PC | layout | M | rejected |

Dropped before proposing: the same main session button on phone and PC (DECISIONS: Quick big on phones, Deep big on wide screens), an end-screen rebuild (its "empty" achievement card and level bar were a screenshot taken mid-animation; the spec now waits), and a site-wide type-scale rewrite (too big for one round).
