# Design loop log

Memory of `/design-loop` (reviewers never read this file). Each loop: state block, scores per round, and what was changed.

## Loop 1 (started 2026-11-06)

```
State: merged
Round: 4
Phase: show
Max rounds: 4
Best lowest: 7
Rounds without progress: 1
Confirming: no
Notes: do a maximum of 4 loops (read as: at most 4 rounds)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 7 | 7 | 6.5 | 7 | 7 | 6.5 | start: main after design review 2026-11-06 |
| 2 | 7.5 | 6.5 | 7 | 7 | 6.5 | 6.5 | colour and motion up after round 1; T and O down 0.5 (reviewer variance, nothing changed there) |
| 3 | 7.5 | 7 | 7 | 7 | 7 | 7 | lowest up 6.5 → 7 (typography and overall back to 7) |
| 4 | 7.5 | 7 | 7 | 7 | 7 | 7 | no change after round 3; stopped: max rounds (4) |

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
- [x] (784762e48) One type scale: nothing under 12px, arbitrary sizes folded into named steps, question prompt smaller so the pinyin wins. Typography.
- [x] (5c3c815ad) Pinyin bigger and consistent: hero larger on phone and PC, the feedback sheet shows the sentence and the answer word at one size. Typography.
- [x] (0a7c08361) Right answers feel like a reward: the sheet's title row shows +XP and the combo; on right answers the review-grade line moves under More (still one tap to change). Overall, motion.

### Round 3

Scores (blind, shots blind-f39af8c54):
- Colour 7.5: coherent, nearly all AA; T5/T2 marginal on tinted sheets; gold/amber carry five meanings next to T2 orange; dark feedback surfaces dim.
- Typography 7: hero pinyin is the star; answer sheet a flat ladder (verdict, sentence, word, gloss, grade all similar); Stats labels tiny and uniform, numbers not data-grade.
- Motion 7: coherent and fast; page still moves ~32px when the sheet opens (the deliberate scroll that keeps the right option visible); option reaction and right reveal slow; right vs wrong still alike.
- Layout 7: clear hierarchy, good sidebar; PC content edge differs per tab and Home is lopsided (P5-type, rejected); question screens use space badly.
- Overall 7: clean and consistent; seal personality only at session end; progress not the hero on Home; Stats and matrix feel like data dumps.

Weakest points per reviewer:
- Colour: tints vs T5/T2 · dark feedback surfaces · gold overloaded.
- Typography: Stats tiny/uniform · answer-sheet ladder flat · hanzi weight vs Latin.
- Motion: jump on sheet open · slow option reaction · right/wrong alike.
- Layout: PC content edge · phone Home rhythm · question screen space.
- Overall: seal only at the edges · progress not the hero · Stats like documentation.

Plan (all four 7s; Home/PC-shell layout ideas = Mikkel's rejected P5, not used; the scroll on sheet open stays because it keeps the right option visible, IDEAS #13):
- [x] (807b30d3b) Faster, distinct answer reaction: the picked option reacts at once (right pops, wrong shakes), the right option lights up sooner after a wrong pick. Motion.
- [x] (b40cd6f60) Answer sheet with clear roles: verdict smaller, the word to learn is the big line, the sentence and the meta lines quieter. Typography, overall.
- [x] (11629acc1) Stats numbers that read as data: one small-caps label style for tile labels and section eyebrows, tabular numbers, larger Stats microtext, one-line matrix header. Typography, overall, layout.

### Round 4

Scores (blind, shots blind-0feea8bca):
- Colour 7.5: disciplined palette, nearly all AA; T5/T2 at the limit on tinted sheets; T2 orange and gold too close; dark feedback sheets muddy; --line very faint.
- Typography 7: short deliberate scale, pinyin hero reads well; Stats small text still uniform; grey neutral-tone syllables and the bordered target pill weaken the hero; card titles 18/20/24 too close.
- Motion 7: coherent tokens, stagger, exits; right vs wrong still mainly colour; sheet fades over the options while the right one lights up; reduced motion snaps instead of fading.
- Layout 7: one main action, consistent cards; PC content edge differs per tab and Home/Library/Settings leave empty space (P5-type, rejected); phone session bottom third empty.
- Overall 7: clean and coherent but restrained; seal personality appears once; reward and progress understated (Home streak, Stats); width contradictions (deliberate: Quick big on phone, Deep big on PC).

Stopped: max rounds (4). Lowest stuck at 7 for rounds 3–4.

Mikkel chose **Stop** (2026-11-06): branch parked, nothing merged. The next /design-loop resumes from here.
Merged into main on 2026-11-06 (all 9 changes approved).

## Loop 2 (started 2026-11-07)

```
State: rejected
Round: 3
Phase: show
Max rounds: 6
Best lowest: 7
Rounds without improvement: 0
Confirming: no
Notes: 3 rounds (resumed 2026-11-07 with the new team: 2 reviewers, director, judge; 3 more rounds)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 7 | 7 | 7 | 7 | 7 | 7 | start: main after loop 1 merge |
| 2 | 7.5 | 7 | 7 | 7 | 7 | 7 | colour up; others unchanged |
| 3 | 8 | 7 | 7 | 7 | 7 | 7 | colour up again; stopped: plateau |

### Round 1

Scores (blind, shots blind-639d2faa9):
- Colour 7: tight jade/cinnabar/gold palette, real dark mode; light T5 fails on --sunk and the pink sheet, T1/T2 close; gold muddy and overloaded; --line/--edge faint.
- Typography 7: real scale, tabular digits; neutral grey weak in the hero (marked word grey on a warm pill); question title competes with the pinyin; small grey text in Stats and a six-role answer sheet.
- Motion 7: tokens, stagger, exits, reduced motion good; wrong pick hard to see; sheet + stagger slow (Continue at ~340 ms); nudge 1.05 overflows the gutter; XP chip a separate slow track.
- Layout 7: phone clean; PC Home empty (P5-type, rejected); PC session/Tone Gym mix left and centre axes, sheet content on another edge; Stats phone long.
- Overall 7: clean, coherent, quiet; rewards flat (end screen leads with a bare low accuracy, no streak flame); one card language for everything; Stats/Settings long documents with many empty states.

Weakest points per reviewer:
- Colour: light tone colours marginal on tints · gold muddy and overloaded · faint lines/edges.
- Typography: weak neutral grey · flat hierarchy on question screens · small grey Stats text and busy sheet.
- Motion: wrong pick unclear, pick+sheet compete · slow stagger · XP chip detached.
- Layout: PC Home (rejected P5) · PC session axes and sheet edge · Stats phone long.
- Overall: rewards flat · one card language · Stats/Settings documents.

Plan (all five at 7; PC Home grid and shared PC container = rejected P5, not used; marked-word amber pill kept, DECISIONS):
- [x] (6b1887409) Contrast tune: light T5 darker (AA on --sunk and the wrong sheet), --line and --edge a step stronger in both themes, dark jade-soft lifted. Colour, typography.
- [x] (e68bd14a6) One axis on PC exercise screens: question title, pinyin and options on one column, the answer sheet's content on that same column. Layout, overall.
- [x] (cdd186b88) Quicker, clearer pick: nudge 1.02 (stays in the gutter), wrong pick colour visible, tighter sheet stagger so Continue lands sooner. Motion.
- QA (one run for the round): nothing to fix.

### Round 2

Scores (blind, shots blind-b512b1bef):
- Colour 7.5: coherent, nearly all AA; tone colours and jade/cinnabar near 4.5 on tinted sheets (dark T1 on jade-soft 4.47); T2 brown close to gold; dark surfaces flat.
- Typography 7: crisp tone marks, real scale; prompt still competes with the pinyin, neutral grey drops out; answer sheet five sizes; Stats/Home small grey captions.
- Motion 7: fast, consistent tokens; 32 px shift when the sheet opens (deliberate scroll, IDEAS #13); right vs wrong mostly colour; reduced motion snaps instead of fading.
- Layout 7: consistent cards; PC Home empty (rejected P5); phone Home uneven gaps, small "No mic" target; PC session header inset from the content column, eyebrow left while question centred.
- Overall 7: well-made tool, not a game; end screen leads with flat tiles (low accuracy), achievement card flat with muddy gold badge; Stats inventory; generic cards.

Weakest points per reviewer:
- Colour: tints vs tone colours · T2 vs gold · flat dark surfaces.
- Typography: prompt vs pinyin, grey neutral · answer-sheet sizes · small captions.
- Motion: shift on sheet open (kept) · right/wrong alike · reduced motion snaps.
- Layout: PC Home (rejected) · phone Home rhythm · session header edges.
- Overall: rewards flat · Stats inventory · generic cards.

Plan (lowest 7 for typography, motion, layout, overall; the scroll on sheet open stays, IDEAS #13; PC Home = rejected P5):
- [x] (6efc541ff) Exercise header and prompt on one axis: close and search icons flush with the content column, block label centred, question prompt quieter (text-base, medium, muted) so the pinyin leads, light neutral tone a step darker. Typography, layout.
- [x] (9dfa7353d) Reduced motion fades instead of snapping: keep short opacity fades, drop only movement. Motion.
- [x] (4c7cb4821) End screen leads with the reward: session numbers in one quiet strip instead of three big tiles, achievement badge readable (light hanzi on gold). Overall.
- QA (one run for the round): nothing to fix.

### Round 3

Scores (blind, shots blind-2e54ab9f2):
- Colour 8: deliberate limited palette, all tone colours AA in both themes; light gold reads brown and close to T2; light feedback tints thin; dark primary jade glows, dark feedback tints muddy.
- Typography 7: real scale, pinyin hero good; the answer word (often neutral grey) loses to the context line; Stats/PC secondary text 12px grey everywhere; session eyebrow/prompt/options near-equal weight.
- Motion 7: coherent tokens, reduced motion now fades; ~30 px content shift when the sheet opens (deliberate scroll, IDEAS #13); sheet text settles ~300 ms; right vs wrong mainly colour; tab change too subtle.
- Layout 7: consistent cards; PC Home half empty (rejected P5); Stats long, chips clip on phone, ragged PC columns; session audio block tall, answers mid-screen.
- Overall 7: restrained, real identity; Home not game-like ("Start a streak today", brown ring, no weakest pair); rewards under-delivered beyond the seal; Stats/Tone Gym look like another product.

Weakest points per reviewer:
- Colour: gold brown/close to T2 · light tints thin, colour-only right/wrong · dark primary loud, tints muddy.
- Typography: answer word loses to context · small grey secondary text · flat session hierarchy.
- Motion: shift on sheet open (kept) · slow sheet text · right/wrong alike.
- Layout: PC Home (rejected) · Stats length/chips · session vertical space.
- Overall: Home not a game · rewards thin · Stats/Tone Gym unfinished.

Stopped: plateau (lowest 7 for rounds 1–3, no progress for 2 rounds). Colour rose 7 → 7.5 → 8; the other four stayed at 7.

Mikkel chose **Stop** (2026-11-07): branch parked, nothing merged. The next /design-loop resumes from here.

Resumed 2026-11-07 with notes "3 rounds": rounds 4–6 with the new process (design-visual, design-experience, director, judge, lived-in profile).

Mikkel stopped the resume on 2026-11-07 before round 4 began (nothing reviewed or built). Parked again.

Mikkel asked for a completely fresh loop with the new setup (2026-11-07): loop 2 discarded, design-loop branch deleted, none of its changes merged.

## Loop 3 (started 2026-11-07)

```
State: running
Round: 1
Phase: review
Max rounds: 3
Best lowest: –
Rounds without improvement: 0
Confirming: no
Notes: max 3 rounds (fresh loop with the new team)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
