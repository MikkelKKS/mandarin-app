# Design loop log

Memory of `/design-loop` (reviewers never read this file). Each loop: state block, scores per round, and what was changed.

## Loop 1 (started 2026-11-06)

```
State: running
Round: 2
Phase: build
Max rounds: 4
Best lowest: 6.5
Rounds without progress: 1
Confirming: no
Notes: do a maximum of 4 loops (read as: at most 4 rounds)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 7 | 7 | 6.5 | 7 | 7 | 6.5 | start: main after design review 2026-11-06 |
| 2 | 7.5 | 6.5 | 7 | 7 | 6.5 | 6.5 | colour and motion up after round 1; T and O down 0.5 (reviewer variance, nothing changed there) |

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

### Round 2

Scores (blind, shots blind-2dde6bba9):
- Colour 7.5: coherent, AA mostly met; dark primary is a glowing pastel mint; tone colours only just pass on tinted sheets; gold and T2 both ochre.
- Typography 6.5: no real scale (9/10/10.5/11/13/15px plus Tailwind steps), text-sm everywhere; prompt competes with the pinyin; one word at three sizes in the feedback sheet.
- Motion 7: shared tokens, stagger, exits, reduced motion fine; right/wrong still mostly colour; sheet grows after appearing; XP chip lingers.
- Layout 7: consistent rhythm and sheet; mixed left/centre axes on exercises; Home empty areas (P5-type, rejected); Stats long.
- Overall 6.5: identity is there; rewards still thin (grade admin line first on Right); Home duplicates numbers; Stats feels like another product.

Weakest points per reviewer:
- Colour: dark mint primary · tone colours near the floor on tinted sheets · edge/gold/T2 muddy.
- Typography: no scale · pinyin not dominant / prompt competes · hanzi weight and tiny Stats labels.
- Motion: right vs wrong alike · sheet drifts as it grows · XP chip lingers.
- Layout: mixed axes on exercises · Home empty areas · Stats long and ragged on PC.
- Overall: rewards thin · Home hierarchy · screens feel built at different times.

Plan (lowest: typography 6.5 and overall 6.5; Home/Tone Gym layout ideas = Mikkel's rejected P5, not used):
- [ ] One type scale: nothing under 12px, arbitrary sizes folded into named steps, question prompt smaller so the pinyin wins. Typography.
- [ ] Pinyin bigger and consistent: hero larger on phone and PC, the feedback sheet shows the sentence and the answer word at one size. Typography.
- [ ] Right answers feel like a reward: the sheet's title row shows +XP and the combo; on right answers the review-grade line moves under More (still one tap to change). Overall, motion.
