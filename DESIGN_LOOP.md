# Design loop log

Memory of `/design-loop` (reviewers never read this file). Each loop: state block, scores per round, and what was changed.

## Loop 1 (started 2026-11-06)

```
State: running
Round: 1
Phase: review
Max rounds: 4
Best lowest: 6.5
Rounds without progress: 0
Confirming: no
Notes: do a maximum of 4 loops (read as: at most 4 rounds)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 7 | 7 | 6.5 | 7 | 7 | 6.5 | start: main after design review 2026-11-06 |

### Round 1

Scores (blind, shots blind-a7f844ecd):
- Colour 7: coherent palette, real dark mode; light tone colours (T2, T3, T5) and gold under AA; dark borders/sheets muddy.
- Typography 7: Instrument Sans + tone-coloured hero pinyin good; no type scale below the hero (~30 arbitrary sizes); Stats/Settings tiny and flat; PC chrome small.
- Motion 6.5: one ease-out curve, good reduced motion; page scrolls under the thumb as the sheet opens (two movements at once); right vs wrong too quiet; no exits.
- Layout 7: clear primary action, good pinned sheet, real PC columns; PC screens have different frames/left edges; phone Home dead lower third; Stats jump chips <44px and clipped on phone.
- Overall 7: solid and coherent but generic; reward moments informative not rewarding; seal identity only at the edges; density drifts (Stats/Settings vs Home).

Weakest points per reviewer:
- Colour: tone colours fail AA on light · gold faint, pale ring track · dark lines 1.28:1, muddy wrong sheet.
- Typography: no scale below hero · Stats/Settings tiny and flat · PC chrome too small.
- Motion: scroll jump when the sheet opens · right/wrong feedback quiet · no exit animations, ad-hoc durations.
- Layout: no shared PC frame · phone Home heavy top/dead bottom · Stats long, chips small.
- Overall: rewards muted · seal identity confined · density drift.

Plan (target: motion 6.5, then the 7s; P5 Home/PC-layout is rejected by Mikkel, so not used):
- [x] (40c3d5449) Sheet without the page jump: scroll before the sheet's first paint (one movement), session header stays visible (sticky). Motion.
- [x] (940dfe359) Sheet that enters in steps and leaves before the next question; +XP chip floats up and fades; shared duration tokens. Motion.
- [x] (a3fa93d05) Readable tone colours, gold and visible control edges in light mode (same hues and meanings). Colour, typography.
