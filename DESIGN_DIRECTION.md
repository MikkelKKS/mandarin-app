# Design direction

## 1. Concept: four colours mean sound, everything else steps aside
Mandarin is a language you hear in pitch, and the learner's hardest problem is tones. So the four tone colours are the app's real content: wherever red, orange, green or blue appears, it means a tone and nothing else. The rest of the app is quiet porcelain and ink, with three non-tone colours that each say one thing: **jade** = go / right, **imperial violet** (紫, the colour of the Forbidden City, 紫禁城) = something you earned, **cinnabar** = a miss, used only as a mark, never as a wash. The learner is a numbers person who loves game mechanics, so numbers are set big, condensed and proud, and every reward has its own short, physical beat. The one memorable thing is the **tone contour**: the small pitch line of each tone (flat ¯, rising ˊ, dip ˇ, falling ˋ) drawn as a stroke, used as a glyph on every tone button, on the matrix headers and in the Tone Gym, and drawn large in tone colour as the "Today" mark on Home. It is the app's signature: the shape of the sound you are training.

## 2. Tokens

### Palette
| Name | Light | Dark | Single meaning |
|---|---|---|---|
| Porcelain (bg) | `#f1f3f2` | `#0e1514` | the page |
| Surface | `#ffffff` | `#18211f` | raised things (≥1.25:1 against bg in dark; no more elevation from hairlines alone) |
| Ink | `#14201f` | `#e6edea` | text; quiet controls |
| Jade | `#0e6b54` | `#3fa685` | primary action, and "right" |
| Imperial | `#6a3fb0` | `#b394f2` | reward: XP, level, combo, streak, achievements, goal |
| Cinnabar | `#b3362a` | `#ef7464` | a miss: cross icon, outline of the wrong pick, a 3px top rule on the wrong sheet |

Supporting: muted `#56635f` / `#9aa8a4`; line `#dde4e1` / `#26312f`; edge (pressable outlines) `#6f7f7a` / `#5f716d` (≥3:1 on bg); imperial-soft `#efe8fa` / `#2a2140`; jade-soft `#dcede6` / `#163a30`.
Tone colours (meanings fixed): T1 `#c42a1c` / `#ff6b5e`, T2 `#b25a00` / `#f5a442`, T3 `#26781f` / `#6cc865`, T4 `#1f62c4` / `#62a6ff`, neutral `#646e77` / `#9aa4ad`.

Rules:
- **Gold is retired.** Every XP number, level bar, combo chip, achievement medallion and the streak flame moves to imperial. No reward may use a tone hue.
- **No pink wash for a wrong answer.** A wrong pick keeps its white/surface fill, gets a 2px cinnabar outline and a small cross badge in its corner, so a red tone-1 label stays readable. The wrong sheet is the normal surface colour with a 3px cinnabar rule along its top edge and the cinnabar "Not quite". The right sheet keeps the pale jade.
- Dark mode's primary button is jade **text-on-dark plate** for big hero blocks (`#173b31` plate, jade-light title, 1px jade edge), not a flat mint slab; small primary buttons stay filled jade.
- Charts that aren't about tones use ink (data) and jade (good/target) only; reward charts (XP) use imperial.

### Type
- **Instrument Sans** (served by the app, already proven with tone marks) for all text and all pinyin.
- **Instrument Sans Condensed** (same family, width axis ~75, from `@fontsource-variable/instrument-sans` with its width axis; if the width axis can't be served, use weight 700 normal width with -0.02em tracking) for **numbers that are the point**: XP totals, streak count, level, Stats hero numbers, accuracy on session end, goal ring value. Set at weight 700, tabular figures.
- Noto Sans SC for hanzi, unchanged.
- Scale (rem, one set of tokens, no one-offs): 0.75 caption · 0.875 small · 1 body · 1.125 lead · 1.375 title · 1.75 heading · 2.25 pinyin hero · 3 numeral · 4.5 numeral-xl. Pinyin roles map onto it: question sentence = 2.25 (2.75 from 768px), answer word in the sheet = 1.75, context sentence = 1.125. The `.py-*` classes become aliases of these tokens.
- Labels are sentence case, weight 600, muted, 0.875. The uppercase tracked `.label` is retired.
- Max three type levels inside any one card.

### Shape, elevation, spacing
- Radius by role: hero plates 28px, cards 16px, controls and options 12px, chips full pill. Not one radius on everything.
- Elevation: page → surface → hero plate. Light mode uses shadow-sm on cards and shadow-md only on hero plates and sheets; dark mode uses the lighter surface plus a 1px line, no black shadows.
- Spacing scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Phone gutter 16, PC gutter 32, card padding 16 phone / 24 PC.

## 3. Screens

### Home, phone: one plate, one button, one next step
Lead: the **Today plate** (a single hero surface). Secondary: Deep session, Tone Gym. Third: everything else.
```
┌─────────────────────────────┐
│  [contour mark in tone col.]│  Today plate (28px radius)
│  23  day streak   🔥violet  │  numeral-xl condensed
│  ◔ 404/100 XP · Level 15 ▰▰▱│  ring + one level bar, violet
├─────────────────────────────┤
│ ▶ Quick session       5 min │  jade, full width, inside or just under the plate
│   24 reviews · 6 tones      │
└─────────────────────────────┘
 Deep session · 20+ min      >   quiet row
 Tone Gym · weakest 1–3  ˉ ˇ >   row with contour glyphs of the pair
 Next badge  一个月  ▰▰▰▱ 77% >   row
 No mic right now?               text link
```
The level line is one row: "Level 15" left, a thin violet bar, "166 XP to 16" right (no "1334/1500 XP" overflow).

### Home, PC: fill the screen, two columns
```
┌sidebar┐┌────────── Today plate (2/3) ──────────┐┌─ This week (1/3) ─┐
│       ││ 23 day streak     ◔ ring   Level 15   ││ Weakest pair 1–3  │
│       ││ [ Deep session  20+ min   ▶ ]  jade   ││ mini 4×4 matrix   │
│       ││ Quick session · 5 min (quiet)         ││ 14-day forecast   │
│       │└───────────────────────────────────────┘│  sparkline        │
│       │┌ Tone Gym ┐┌ Reading ┐┌ Next badge ┐    │ Retention 95%     │
│       │└──────────┘└─────────┘└────────────┘    └───────────────────┘
```
Content reaches at least 80% of the viewport height at 1440×900. The right column gives the numbers person something to look at before he starts.

### Session question and answer sheet
- Lead: the pinyin (or the audio button for listening). Secondary: the options. Header: close, progress, XP in imperial, dictionary.
- **Every tone option carries its contour glyph** under the pinyin (in review sessions too, not only Tone Gym), so tone is never colour alone.
- Options: 12px radius, edge outline, 64px tall on phone; "I don't know" is a full-width quiet button (48px), not a small link.
- The answer sheet slides over the bottom without moving the page. No scroll: the sheet already shows the right answer, so the question stays perfectly still.
- Right sheet: pale jade, tick, "Right", +XP chip in imperial in the title row. Wrong sheet: surface + cinnabar top rule, "Not quite", "It was 2, not 1" with both contour glyphs, the two play buttons.

PC: a two-pane shell, the exercise in a 720px column and a **This round** rail on the right:
```
│   ✕ ▰▰▱▱▱▱▱▱▱▱                     │ This round           │
│   Tone Gym: which tone?            │ ● ● ● ○ ● ● (dots in │
│        (( ▶ ))                     │   result colour)     │
│          zao                       │ Combo ×1.4  ▰▰▰▱     │
│  [zāo ¯][záo ˊ][zǎo ˇ][zào ˋ]      │ +46 XP               │
│        [ I don't know ]            │ Blocks: Reviews ▸    │
│  ── answer sheet (column width) ── │  New · Listen · Tones│
```

### Session end
Lead: the seal stamp and the condensed **+312 XP** in imperial. Then one row of three numbers (accuracy, best combo, minutes), then the level bar, then "Weakest tone pair today: 2–3" with glyphs. New achievements are a grid of medallions (3 across), not a list; tapping one shows its line. Max two buttons.

### Tone Gym
Lead: **Workout** as the hero plate with the weakest pair drawn as two big contour strokes in their tone colours ("1–3 · missed 33%") and the best score. Even mix is a quiet row. The matrix follows directly, with contour glyphs in its headers. The intro paragraph shrinks to one line; the speaker credit moves under the matrix.

### Stats, phone and PC
Lead: a **summary hero**: four condensed numbers (words started, retention 30 days vs 90% target, streak, level) and directly under it **the tone matrix** with the pair mix-ups. Below: sticky segmented tabs **Overview · Words · Tones · Habits · Badges**, showing one panel at a time; Overview = pace forecast + 14-day reviews. HSK levels with zero started collapse into one line ("HSK 2–9 not started yet"). PC: hero across the top, panel in two balanced columns; no single long scroll.
```
┌ 319 words │ 91% kept │ 23 days │ Lv 15 ┐
├ Tone matrix 4×4  ·  pairs you mix up   ┤
[Overview][Words][Tones][Habits][Badges]  ← sticky
 panel …
```
Settings: grouped under four headings (Learning, Sound & display, Microphone, Data), each a group list; long explanations behind a "?".

### The first day
Home for a new account replaces the zero plate with a **welcome plate**: the four contour strokes in their colours, "Mandarin by ear. Tones first.", and two choices: "Start with HSK 1" (jade) and "I know some already: find my level". No 0-of-100 ring, no 0% badge. New-account Stats shows the hero with dashes and one line: "Your numbers appear after your first session."

## 4. Motion and reward
- Curves: `--ease-out` for things arriving, `--ease-in` for leaving, `--ease-spring` only for rewards. Durations: micro 160ms, std 240ms, sheet 280ms, exit 150ms, celebration 600–900ms.
- One orchestrated moment per event, never two at once:
  - **Right**: option pops (spring), tick draws, +XP chip springs into the header XP and the number ticks up.
  - **Wrong**: shake 8px / 4 steps, cross draws, the right option outlines in jade after 60ms.
  - **Combo**: the chip pulses at 3, 5 and 10 in a row, growing a step each time (×1.2 → ×1.5 → ×2); at 10 the rail/header briefly glows imperial. Breaking a combo just resets quietly.
  - **Goal reached** (first time today): the ring closes and a small seal 达标 stamps on it.
  - **Level up**: a full-width violet band drops over the sheet: "Level 16", condensed numeral counting up, 900ms, tap to dismiss.
  - **Achievement**: the medallion flips in with the stamp curve on session end, one at a time, 120ms apart.
  - **Streak**: the flame on Home grows one step at 7, 30 and 100 days.
- Reduced motion keeps opacity fades (150ms) and colour changes, drops all movement, scale and shake. Nothing is 0.01ms.

## 5. Copy voice
- Plain, short, sentence case, second person. Say the number, not the adjective: "Missed 1–3 a third of the time", not "Tones need work".
- Name actions by what happens: "Start quick session", "Play again", "Find my level".
- Rewards are brief and specific: "Level 16", "10 in a row ×2", "Goal reached: 23 days".
- Misses don't scold or apologise: "Not quite. It was 2, not 1."
- Chinese appears as real words with meaning (不错, 达标), not decoration.

## 6. Avoid
- Gold or any orange/red/green/blue for rewards or decoration: those hues belong to tones.
- Pink or red washes behind tone-coloured text.
- A stack of equal white cards with the same radius and the same shadow (the current Home and Stats).
- Uppercase tracked labels above every section; middle-dot strings as the only structure ("Goal reached · 2 freezes").
- Big empty halves of the screen on PC; a 720px column floating in 1440px.
- Walls of equal bars: in Stats, one hero, one lead chart, the rest on tabs.
- A flat bright mint slab in dark mode.
- Generic confetti or emoji celebration; our celebrations are stamps, numerals and the violet band.
- Animations on things the user didn't do, except the one celebration per event.
