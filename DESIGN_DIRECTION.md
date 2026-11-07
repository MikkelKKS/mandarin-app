# Design direction: Pitch Staff

**Concept.** Mandarin tones have their own notation: Chao's five pitch levels (˥ ˦ ˧ ˨ ˩). This direction makes the app a **score**: a quiet five-line pitch staff runs behind every pinyin stage, and each tone is drawn on it as a stroke across the staff (T1 high and flat at 5–5, T2 rising 3–5, T3 dipping 2–1–4, T4 falling 5–1). When the audio plays, the stroke **draws itself along the staff in time with the sound**; that is the one memorable thing and the signature motion. Titles and numbers move to a crisp serif (**Newsreader**, served by the app, optical sizes), hanzi on seals and session-end stamps to **Noto Serif SC**: the feel of a well-set music book, not a SaaS kit. The palette goes from jade-green-on-grey to **ink on xuan paper with indigo**, cool rather than cream.

**Tokens.** Light: paper `#f3f4f0` (cool, not cream), surface `#fbfbf8`, ink `#1a2230`, staff line `#d6dad6`, indigo `#2b3f72` (靛蓝: go / primary, the plate), imperial `#6a3fb0` (earned), miss `#a8432f` (brick, a mark only). Right = indigo tick + the drawn stroke; no green wash (green belongs to T3). Dark: `#11151d`, `#1b212c`, `#e7e9ee`, line `#2c3442`, indigo `#8fa6e6`, imperial `#b394f2`, miss `#e8806b`. Type: Newsreader 500/600 for titles (1.75 / 2.25rem) and numerals (3 / 4.5rem, lining figures); Instrument Sans for body and all pinyin; Noto Serif SC 700 for seals.

**Home, phone.** The plate is indigo with a faint staff; the streak numeral sits on it in Newsreader; this week's weakest pair is drawn as its two strokes across the staff, big.
```
┌ indigo plate, staff lines ─┐
│ 23  days      ◔ 438 today  │
│ ¯¯¯╲__╱  1–3 missed 33%    │
│ [ Quick session  5 min  > ]│
└────────────────────────────┘
 Deep · Tone Gym · Next badge rows
 Week: M T W T F S S  ● ● ● ● ● ○ ○
```
**Session question.** The syllable sits on a wide staff band; the tone tiles are mini-staves, each with its stroke. PC: the staff band spans the whole stage (1080px) with tiles beneath and a slim scoreboard rail at right.
```
 ✕ ▰▰▱▱      46 XP
        Which tone?
 ═══════════════════════  ← 5-line staff
          l i e            (stroke draws as audio plays, after you answer)
 ═══════════════════════
 [¯ liē][╱ lié][╲╱ liě][╲ liè]
```
**First moves.**
1. **Tokens + type + staff component** (L): `index.css` palette, Newsreader + Noto Serif SC via Fontsource, a `PitchStaff` component replacing `ToneContour` at large sizes (contour glyphs stay at small sizes). Screens: all; Home, session, Tone Gym and Stats matrix headers use it first.
2. **The stage as a score, PC and phone** (L): session + Tone Gym question/feedback rebuilt on the staff band, answer stroke draws on the staff after answering (right: your stroke in tone colour; wrong: yours dashed, the right one drawn over it, 400ms), PC stage + rail, sheet slot reserved. Screens: session-*, tone-gym-*.
3. **Session end as a page of the score** (M): Noto Serif SC seal, new words, weakest pair today drawn on the staff.
4. **Stats with an identity** (M): the matrix headers as mini-staves, Newsreader numerals, a first-day page showing an empty staff with "Your strokes appear after 20 tone answers."

**Kept from before.** The tone colours and their meanings (1 red, 2 orange, 3 green, 4 blue, neutral grey), the contour glyphs at small sizes, pinyin as the star in Instrument Sans, violet for anything earned, the 学 logo (cinnabar tile), hanzi off in listening, Quick big on phones and Deep big on PC, the lived-in Home plate, Stats lead numbers and tabs, the reward beats on the session end.
