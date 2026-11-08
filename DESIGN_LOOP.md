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
State: merged
Round: 2
Phase: show
Max rounds: 2
Best lowest: 6.5
Rounds without improvement: 0
Confirming: no
Notes: max 3 rounds (fresh loop with the new team)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 7.5 | 7 | 6.5 | 6.5 | 7 | 6.5 | start: fresh loop on main, new team |
| 2 | 7.5 | 7.5 | 6.5 | 7 | 7 | 6.5 | judge: 3 kept, 0 reverted |

### Round 1

Scores (blind, shots blind-a945beb91; lived-in profile):
- Colour 7.5 (fails 3, 4, 5): gold/XP and T2 share a hue, T1 close to wrong-red; dark surface 1.1:1, loud mint card; Stats/Settings have no lead; --edge 2.94:1.
- Typography 7 (fails 1, 3, 4): one-off pinyin sizes beside the scale; Home streak card and Tone Gym sheet 4–5 levels; 12px secondary text on Stats/Settings; voice light.
- Layout 6.5 (fails 1, 4, 5, 6): XP text overflows the Home card; PC Home/session/Tone Gym half empty; Stats 15,000 px and Settings 9,600 px walls; row patterns differ.
- Motion 6.5 (fails 4, 6, half 5): ~30 px jump when the sheet opens; reduced motion snaps with no fades; no beat for level up / goal / achievement.
- Overall 7 (fails 1, 2 partly, 5): Stats in another register, identity weak on Stats and questions; no Stats payoff, matrix buried.
Note: reviewers opened fewer screens than asked (experience: 5 stills, a few frames).

Weakest points:
- Visual: PC dead space · Stats/Settings walls · gold = T2, T1 ≈ wrong · crowded Home card/sheet · tone colour-only cues in sessions.
- Experience: Stats wall without payoff · sheet jump · reduced motion snaps · quiet rewards · Home flat stack, XP text clipped.

Direction (design-director, opus): "four colours mean sound": tone hues only for tones; jade = go/right, imperial violet = reward (gold retired), cinnabar = a miss as a mark only; tone-contour glyph as the signature; condensed numerals; one type scale; Home Today plate (+ PC "This week" column); Stats hero + matrix + tabs; reward beats; PC "This round" rail. See DESIGN_DIRECTION.md.

Plan (round 1; director's moves 1–3):
- [x] (37e25f20a) Token swap: imperial reward colour replaces gold, wrong answers without pink wash (outline + cross, sheet with cinnabar top rule), dark surface/edge/hero plate, one type scale with pinyin aliases, sentence-case labels, role radii, condensed numerals. Colour, typography; all screens.
- [x] (fd3618d7a) Tone contours and a still question: contour glyph on every tone option (sessions, Tone Gym, matrix headers), no page scroll when the sheet opens (sheet shows the answer), "I don't know" as a full-width quiet button. Colour 3, motion 4, layout 3; session, Tone Gym, stats.
- [x] (1e5d5a2d6) Home redesign: Today plate (streak numeral, ring, one-line level) with the session buttons; quiet rows; PC two-thirds plate + "This week" column; welcome plate for a new account. Layout, overall, typography; home, home-new.
- Judge (pairs-1, 13 screens × 2 orders): better on all 13 (home phone light: better + one unopened pair); answer-wrong motion better. Kept: all 3 moves. Note from judge: six stacked achievement medals on the session end nearly touch.
- QA: qa:screens 28/28, the three Home e2e specs 14/14 after one test fix (session.spec waited for the old Home text). Nothing else found.

### Round 2

Scores (blind, shots blind-349a8c53b):
- Colour 7.5 (fails 3, 4, 5 small; 6 partial): no second tone cue in running pinyin; cinnabar ≈ T1, jade ≈ T3; dark elevation 1.27:1; plate has two first reads.
- Typography 7.5 (fails 1, 3, 4 small): legacy lg/xl steps and a 2.75rem PC hero; Tone Gym sheet five levels; 12px secondary text on Stats/Settings.
- Layout 7 (fails 1, 3, 4, 5, 6): PC session edges; Tone Gym question top-heavy (bottom half empty); PC Home plate stretched with empty space; Stats 15,000 px, Settings flat; icon tiles and card styles differ.
- Motion 6.5 (fails 2, 4, 5; 6 half; 3 small): right answer has no beat; answer-right frames show the picked option with a red cross under "Right" (recording artefact: the test forces the verdict); no goal/level/streak beat at session end; reduced motion snaps.
- Overall 7 (fails 1, 4, 5, 6): Stats/Tone Gym in a plainer style than Home; rewards not celebrated; Stats wall, matrix far down; stats-new a wall of empty cards; "First session" badge on a 23-day streak (profile artefact).

Weakest points: Stats wall · PC Home stretched · exercise screens top-heavy · dark elevation · Settings flat · right-answer beat · session-end payoff · reduced-motion snaps.

Plan (round 2; the last build round, since round 3 only scores with max 3 rounds):
- [x] Screenshot harness: right-answer shots on a typed question (a forced "right" can't move a multiple-choice pick), and badges unlocked before the session (not a design move).
- [x] (71fbf5e09) Stats restructure: summary hero (condensed numbers) with the tone matrix right under it, sticky tabs (Overview, Words, Tones, Habits, Badges) showing one panel at a time, HSK levels not started folded into one line, one line for a new account. Layout 5, overall 1/5/6, typography 4; stats, stats-new.
- [x] (40c348032) Reward beats and gentle reduced motion: right pick pulses with a jade glow, combo chip pulses at 3/5/10, session end stamps 达标 when the goal was reached and shows a level-up band, achievements as a medallion grid that stamps in one by one; reduced motion keeps 150 ms fades. Motion 2/5/6, overall 4; session-right, session-end, answer-right.
- Judge (pairs-2, 10 screens × 2 orders, before re-shot from the round's start with the fixed harness): Stats better on phone light, PC light, stats-new; phone dark same. Session end better ×3, answer-right motion better. Worse: reduced-motion answer-wrong (the 150 ms fading sheet ghosts over the options) and the session-right still (different state: only the before shot caught a combo chip; layouts identical, not caused by the move).
- Kept: Stats restructure; reward beats. Reduced-motion fades taken out again (8a508aadf) instead of reverting the whole reward move (their part was the only thing judged worse). Rounds without improvement: 0.
- QA: qa:screens 28/28, the four Stats e2e specs 40/40; two small fixes (first-day button alignment, "HSK 2 to 7–9"). Level-up band and badge grid not seen in the run (no level crossed, no badge unlocked).

Stopped after round 2 at Mikkel's request (max rounds set to 2). Round 2's moves were judged but not re-scored.

Mikkel saw the before/after and kept all 5 changes; merged into main on 2026-11-07.

## Loop 4 (started 2026-11-07)

```
State: merged
Round: 3
Phase: show
Max rounds: 3
Best lowest: 7
Rounds without improvement: 0
Confirming: no
Notes: 3 rounds (builds in rounds 1–2; round 3 scores the result)
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 1 | 8 | 7.5 | 7.5 | 7 | 7.5 | 7 | start: main after loop 3 merge |

### Round 1

Scores (blind, shots blind-51653f6c1):
- Colour 8 (C3 miss, C1/C2 small): tone colour alone in sentences and the answer sheet, T1/T2 close in lightness; T5 4.28 on jade-soft; violet both reward and progress; Library/Settings/Tone Gym have no colour lead.
- Typography 7.5 (T1, T2 on Tone Gym, T3, T4 small): display = heading duplicate, 2.75rem hero one-off; Tone Gym question title competes with the syllable; wrong sheet 5 levels; Settings small muted text.
- Layout 7 (L1, L4, L5, L6 partial): PC left edge jumps (Home/Stats x≈315, others x≈513); PC session/Tone Gym/Library/Settings narrow columns with dead space; XP toast overlaps combo chip on PC; Stats tab bar under the matrix, PC tab content far down; summary cards in three styles; sparse first-day screens.
- Motion 7.5 (no clear fails; item 2 weakest, 6 at risk): right answer has no beat on the option; several movements start together; reduced motion snaps.
- Overall 7.5 (1, 6 partial; 4, 5): identity strong on Home/Tone Gym, generic in session/Stats/Library; placement card still on a lived-in Home; empty lower thirds; first day shows no game.

Weakest: PC width and left edge · exercise first read · Stats order · tone cue without colour · first-day screens · right-answer beat · reduced-motion snaps.

Direction (design-director, opus, revised): same concept; tone colour never alone at answer size (contours), T1 crimson / T2 amber / neutral passing on jade-soft, violet stamps and a jade logo seal, two card looks only, one PC frame (same left edge, 1080 max), exercise screen with the pinyin as the only big thing and a PC "This round" column, right-answer moment, reduced motion = instant panel + content fade, Home/Stats story incl. day one.

Plan (round 1; director's moves 1–2, plus a harness fix):
- [x] (ee0494dca) Harness: the wrong-answer shot is a genuinely wrong pick (a forced "wrong" on a right pick showed no cross).
- [x] (fcd0cba93) Colours, type and one PC frame: new T1/T2/T5, violet stamps, jade logo seal with contours, one type scale (no duplicate/off-scale/one-offs), sunk boxes retired, one PC frame for every page, Tone Gym Workout plate with the weakest pair's contours, Settings groups with short lines, dark plate button. Colour 1/2/3/5, typography 1/4, layout 1/4/6; all screens.
- [x] (17783a676) Exercise screen and PC "This round" column: small prompt, one quiet voice/volume row, pinyin the only big thing, tone glyphs in the answer sheet, three-level wrong sheet, PC side column with result dots, combo, XP and keys. Typography 2/3, layout 4, colour 3; session and Tone Gym screens.
- Judge (pairs-1, 12 screens × 2 orders; before re-shot from the round start with the fixed harness): better on 10 (Library, Settings, Tone Gym ×3, session question ×2, session wrong ×2, Tone Gym question); phone light Home same; phone dark Home worse (the outlined dark session button reads weaker than the light one). Kept both moves; the dark button part taken out (2c8efc787). Rounds without improvement: 0.
- QA: qa:screens 28/28, session/tone-gym/lesson e2e 24/24; nothing fixed. Notes: the Tone Gym round has no prompt line (never had); PC Home on a new account leaves the right two-thirds empty (for move 4).
| 2 | 8 | 7.5 | 7.5 | 7 | 7.5 | 7 | judge: 2 kept (one detail undone) |

### Round 2

Scores (blind, shots blind-d9489b933): unchanged although the judge preferred the round-1 screens 10 to 1.
- Colour 8 (2, 4 partial): jade = action and right; dark plate barely separates from the rows.
- Typography 7.5 (3, 4 in places, 6): Home plate 6+ levels; Music/Settings/Stats captions small; thin voice beyond the numerals; PC hero only ~40px.
- Layout 7 (1, 3, 4, 5): the This round card hangs off-axis; phone exercises sit in the top 55% (answers not in thumb reach); PC Home empty lower half; Settings and Music walls; Stats range text wraps.
- Motion 7.5 (2, 5, 6): right answer only pop + tick + chip; sheet text half-faded mid-slide; session end reads as one flourish; reduced motion snaps.
- Overall 7.5 (1, 4, 6): identity on Home only; reward layer thin outside Home; first day blank below the welcome.

Weakest: exercise layout (thumb reach, PC scale) · walls (Settings, Music, Stats) · Home plate overloaded · PC Home empty · right-answer and session-end beats · reduced motion.

Plan (round 2; the last build round):
- [x] (feb21c3c6) Exercise layout: question vertically centred on phones too (answers lower, nearer the thumb), bigger pinyin hero and syllable on PC. Layout 3/4, typography 2; session and Tone Gym screens.
- [x] (befbcf853) Right-answer moment and reduced motion: sheet contents slide without fading (no half-faded text over the options), a jade ring pulse on the right pick; reduced motion keeps an instant sheet and fades only its contents (a different execution from the fade that was judged worse). Motion 2/4/6; session-right, answer motion.
- [x] (5b0d0162b) Home tells the story: "This week" on phones too, placement row hidden once 50 words are started, the ring shows today's XP once the goal is passed, a first-day preview (streak, level, empty matrix) under the welcome plate. Layout 4, overall 4/6; home, home-new.
- Judge (pairs-2, 10 screens × 2 orders): better on 8 (Home ×3, home-new ×2, session question phone light and dark, reduced-motion answer-wrong), same on 2 (PC session question, answer-right motion), worse on none. Kept all three moves. Rounds without improvement: 0. Judge note: "XP today" sits close to the ring stroke.
- QA: qa:screens 28/28, session/placement/dont-know e2e 22/22; one fix: the This round card sits above the answer sheet's backing on wide PC screens.
| 3 | 8 | 7.5 | 7 | 7 | 7.5 | 7 | judge: 3 kept; final round |

### Round 3 (scores only)

Scores (blind, shots blind-704054e9b):
- Colour 8 (1, 5 small): T2 on jade-soft 4.30 on the Tone Gym right option; colour leads only on the plate.
- Typography 7.5 (1, 3, 6 partial): hero 36/48/56 steps plus legacy steps; Home Deep row and Stats matrix card many levels; neutral voice beyond numerals.
- Layout 7 (4, 1, 5, 6): PC session narrow with a detached side card; PC Home dead zone; Stats tabs below the matrix; Settings wall; row styles differ.
- Motion 7 (1 partly, 3, 4): the centred question jumped ~37 px when the sheet opened (side effect of round 2's centring); exit frame where sheet, action bar and Continue overlap; blank frame in tab changes.
- Overall 7.5 (1, 2, 3 partly, 6): identity strong on Home, Stats, session end, first day; quiet screens generic; PC Home not a dashboard.

After scoring: fixed the jump (531b60eda): the centred column keeps its height; extra room for a tall sheet sits after it. Re-recorded: ~14 px left, from the "browser's voice" note that only appears because tests block audio.

Stopped: max rounds (3). Lowest 7 in all three rounds; the judge kept 5 of 5 moves (two small details undone) and preferred the new screens 18 to 1.

Mikkel approved all changes but kept the 学 logo (restored before merging); merged into main on 2026-11-07.

## Review 2026-11-07 (loop 5)

```
State: stopped (max)
Round: 1
Phase: final
Max rounds: 1
Best lowest: 7
Rounds without improvement: 0
Confirming: no
Baseline: bf617c008
Notes: none
```

| Round | Colour | Typography | Motion | Layout | Overall | Lowest | Note |
|-------|--------|------------|--------|--------|---------|--------|------|
| 0 | 7.5 | 7.5 | 7.5 | 7 | 7 | 7 | baseline · fails 10 (C1.5 T2 L2.5 M1.5 O2.5) |
| 1 | 7.5 | 7.5 | 7.5 | 6.5 | 7.5 | 6.5 | fails 9.5 (was 10) · judge 2 kept (PC sheet overlap fixed) |

### Round 0 (baseline review)

Scores (blind, shots blind-82351eef2; all key screens opened):
- Colour 7.5 (fails 1.5: C1 tints/disabled button, C3 T1 ≈ cinnabar, C6 generic kit): nothing in the palette ties to Mandarin beyond the tone hues.
- Typography 7.5 (fails 2: T1 small labels/one-offs on PC, T4 side card 12–13px, T6 no display voice).
- Layout 7 (fails 2.5: L4 PC session/Home/Tone Gym empty halves, L5 Settings wall, L1 side card on another edge and jumps, L3 phone question high).
- Motion 7.5 (fails 1.5: item 4 prompt shifts ~14 px, header re-lays out when the +XP chip leaves, exit frame with Check/I-don't-know/Continue overlapping; item 2 the wrong pick can sit under the sheet).
- Overall 7 (fails 2.5: item 6 stats-new dashes and PC like a stretched phone, item 2 Stats/Settings generic, item 4 thin game layer (no week row, no quests, session end lacks new words / weakest pair), item 1 Settings and Tone Gym top bars differ).

Direction: Mikkel tried live previews of three directions (A Jade Studio finished, B Pitch Staff, C Tone Arcade) and picked **B: Pitch Staff** (written to DESIGN_DIRECTION.md). He also asked for the missing "Optimise my scheduler" button to be built after the review (on main).

Plan (round 1; the only build round):
- [x] (38cf8c992) Ink, indigo and a serif: xuan-paper and indigo tokens (go, plate, right without a green wash), brick misses, Newsreader for titles and numbers, Noto Serif SC for seals, a PitchStaff component. Colour 6, typography 6, overall 2; all screens.
- [x] (3a63ce78e) The stage as a score: session and Tone Gym tone questions on a staff band, tiles as mini staves, the right stroke draws itself after answering (wrong: yours dashed, the right one drawn over it), the weakest pair drawn on the Home plate, phone answer sheet without re-centring. Motion 2/5, overall 2/4, layout 3; session, Tone Gym, Home.
- Judge (pairs-1, 13 screens × 2 orders): better on 10 (Home phone light, dark and PC; session question; session wrong phone light and dark; Stats; Tone Gym PC; Tone Gym question; Tone Gym answer motion), same on 2 (session end, answer-wrong motion), worse on 1 (PC session wrong: the answer sheet covered the tone tiles at 1440×900). Kept both moves; the PC overlap fixed (fbc025c44: shorter staff and a higher column on PC). One judge letter (Tone Gym question) contradicted its own reasoning; counted by the reasoning. Rounds without improvement: 0.
- QA: qa:screens 28/28, no console errors; the PC sheet clears the tiles in both themes; nothing fixed. Small notes: "XP today" close to the ring edge, "Reviews, next 14 days" wraps on PC Home, the next-badge title wraps near its percentage.

### Round 1 (scores only)

Scores (blind, shots blind-23fe112ef):
- Colour 7.5 (fails 1.5: C1/C4 dark card edge 1.13:1, C2 navy action next to T4 blue).
- Typography 7.5 (fails 1.5: T1 off-scale PC hero and many 12–14px roles, T3 Home rows and Stats cards many levels, T4 small secondary text).
- Layout 6.5 (fails 2.5: L4 PC Home/session/Tone Gym dead zones, L5 Stats tabs mid-page and Settings wall, L1 PC sheet wider than the column, L2 uneven gaps, L3 small slow buttons).
- Motion 7.5 (fails 2: item 4 the typed question shifts ~14 px when the browser-voice note appears, item 3 exit frame overlaps Continue and the next bar, item 5 thin right-answer beat on typed cards).
- Overall 7.5 (fails 2: item 4 thin game layer, item 6 stats-new empty and PC like a stretched phone).

Stopped: max rounds (1).

Baseline judge (main bf617c008 vs the branch, 22 key screens × 2 orders): the branch is better on all 22 in both orders. Before/after: design-review/2026-11-08-final/compare.html.
