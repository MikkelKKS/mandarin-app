# Design direction

## 1. Concept: four colours mean sound, everything else steps aside
Mandarin is a language you hear in pitch, and the learner's hardest problem is tones. So the four tone colours are the app's real content: wherever red, orange, green or blue appears, it means a tone and nothing else, and it never appears alone: every tone colour travels with its **contour** (flat ¯, rising ˊ, dip ˇ, falling ˋ), so a tone reads by shape as well as hue. The rest of the app is quiet porcelain and ink, with three non-tone colours that each say one thing: **jade** = go / right, **imperial violet** (紫, the Forbidden City's colour) = something you earned, **cinnabar** = a miss, only as a mark. The learner is a numbers person who loves game mechanics, so numbers are set big, condensed and proud, and the most frequent event, a right answer, gets a real physical beat. Each exercise is a **stage**: one syllable or sentence of pinyin in the middle, everything else small and at the edges. The one memorable thing stays the tone contour: the shape of the sound you are training, on every button, in the matrix, on the Tone Gym plate and as the mark of the app.

## 2. Tokens

### Palette
| Name | Light | Dark | Single meaning |
|---|---|---|---|
| Porcelain (bg) | `#f1f3f2` | `#0e1514` | the page |
| Surface | `#ffffff` | `#202b29` | raised things |
| Ink | `#14201f` | `#e6edea` | text, quiet controls |
| Jade | `#0e6b54` | `#43b08b` | primary action, and "right" |
| Imperial | `#6a3fb0` | `#b394f2` | reward only: XP, level, combo, streak, goal, badges, celebratory stamps |
| Cinnabar | `#b3362a` | `#ef7464` | a miss: cross, outline of a wrong pick, top rule of the wrong sheet, matrix mix-up cells |

Supporting (unchanged): muted `#56635f` / `#9aa8a4`; line `#dde4e1` / `#26312f`; edge `#6f7f7a` / `#5b6d6a`; imperial-soft `#efe8fa` / `#2a2140`; jade-soft `#dcede6` / `#163a30`; plate `#0e6b54` / `#173b31`.

**Tone colours** (meanings fixed; T1 and T2 now split by hue *and* lightness):
T1 crimson `#c8102e` / `#ff6b7a` · T2 amber `#a35a00` / `#f5a442` · T3 `#26781f` / `#6cc865` · T4 `#1f62c4` / `#62a6ff` · neutral `#58626a` / `#9aa4ad`.
T1 leans cool (towards crimson), T2 leans warm-yellow, so they no longer read as two shades of the same rust. Every tone colour must pass 4.5:1 on surface, page **and** jade-soft (the right sheet); the darker neutral fixes the 4.28:1 miss.

Rules:
- **Tone colour never travels alone.** Wherever pinyin is tone-coloured at answer size (options, the answer word in the sheet, "It was 2, not 1", Tone Gym, Home's weakest pair), the contour glyph sits under or beside it. Running sentence text stays colour-only (glyphs there would be noise); the colour-off setting still works.
- **Imperial is reward, and reward only.** The next-badge progress bar is a reward, so it stays violet; nothing else violet. The 不错 / 达标 stamps are imperial, not cinnabar. The app mark is a jade seal carrying the four contours (no red block in the sidebar).
- Every screen has a colour lead: Home and Tone Gym a jade plate, Stats the numerals, Library a jade "Continue" row, Settings none (it is a tool, and quiet is right there).
- Dark mode: the button inside the plate is the deep-plate tone with a jade edge, never a bright white or mint slab; the brightest thing on dark Home is the streak numeral.
- Charts not about tones: ink for data, jade for good/target; XP charts imperial.

### Type
- **Instrument Sans** (served by the app) for all text and pinyin; **Instrument Sans condensed width** (`.num`, weight 700, tabular) for numbers that are the point; Noto Sans SC for hanzi.
- One scale, no duplicates, no one-offs (rem): 0.75 caption · 0.875 small · 1 body · 1.125 lead · 1.375 title · 1.75 heading · 2.25 hero · 3 numeral · 4.5 numeral-xl. `display` is removed (it was a copy of heading). Pinyin on stage: hero (2.25) on phones, **numeral (3)** from 768px, so `.py-hero` uses scale steps only. Answer word in the sheet 1.75; context sentence 1.125.
- Every `text-[…]` arbitrary size maps to the nearest step. The matrix corner label is small (0.875), not caption.
- Labels sentence case, 600, muted, small. Max three type levels inside any one card or sheet.

### Shape, elevation, spacing
- Radius by role: plate 28 · card 16 · control/option 12 · chip pill.
- **Two surface looks only:** the jade plate (one per screen, the lead) and the white card (shadow-sm light; lighter surface + 1px line dark). The sunk grey "info" box is retired: an explanation is plain muted text, a callout is a card.
- Spacing 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Phone gutter 16, PC gutter 32, card padding 16 / 24.
- **One PC shell:** every page's content starts at the same left edge right after the sidebar (32px gutter) and runs to a 1080px max. Narrow content (a form, a list) sits in the left 720px of that, with a right column for context when the page has any; nothing floats centred in the middle of the screen.

## 3. Screens

### Home, phone
Lead: the Today plate (streak numeral, goal ring, level line, Quick session inside). Then Deep session, Tone Gym, next badge as rows. **The placement row disappears once 50 words have been started** (it stays reachable in Settings → Learning). Under the rows, a compact **This week strip** fills the lower third: weakest pair with contours, accuracy per tone as four short bars, kept-30-days numeral.
```
┌ Today plate ───────────────┐
│ 23 day streak       ◔ 366  │
│ Level 15 ▰▰▰▰▱ 204 XP to 16│
│ [ Quick session  5 min  > ]│
└────────────────────────────┘
 Deep session · 20+ min     >
 Tone Gym · 1–3 ¯ˇ missed 33% >
 Next badge 一个月 ▰▰▰▱ 77% >
┌ This week ─────────────────┐
│ 1–3 ¯ˇ   ¯▰▰▰▱90  ˊ▰▰▰▱81  │
│ kept 90% ˇ▰▰▱▱74  ˋ▰▰▰▱80  │
└────────────────────────────┘
```
### Home, PC
As built: plate (2/3) + This week column (1/3). The placement row follows the same 50-word rule; the column stretches to the plate+rows height.

### The first day (Home and Stats, new account)
The welcome plate stays. Under it, a **preview of the game** instead of a dead half: three ghost tiles in muted outline, each with a real target, "Day 1 of your streak", "Level 1 · 0 / 100 XP", "Tone matrix fills in after 20 tone answers" with the empty 4×4 drawn in line colour and the contours in their colours on the headers. New-account Stats: the lead numbers as dashes, then the same empty matrix ghost and one line, "Your numbers appear after your first session."

### Session question (the stage), phone
Order, top to bottom: header (close, progress, XP counter in imperial, dictionary) → a small muted prompt ("Which tone?", small, 600; the "Tone Gym:" prefix goes) → the stage (audio button, then the pinyin at hero size) → options → "I don't know". Audio extras form **one compact row under the play button**: "Another voice" as a small quiet chip and the volume as an icon button that opens the slider in a popover; nothing sits between the audio and the syllable except that one row.
```
 ✕ ▰▰▰▱▱▱▱    249 XP  ⌕
 Which tone?                 small, muted
          (( ▶ ))
     [↻ voice] [vol]          one small row
           er                stage, hero
 [ēr ¯][ér ˊ][ěr ˇ][èr ˋ]
 [      I don't know      ]
```
### Session question, PC: stage + rail
Exercise column 720px at the shell's left edge; a **This round rail** (280px) to its right: progress dots in result colours (jade dot right, cinnabar ring miss), combo meter and chip, XP gained this session (the +XP chip flies here, so it never overlaps anything), the blocks of a deep session with the current one marked, and keyboard hints (Space replay, S slow, 1–4 pick, Enter continue).
```
│ ✕ ▰▰▱▱▱▱               │ This round        │
│ Which tone?            │ ●●●○●● 5/20       │
│     (( ▶ )) [voice][vol]│ Combo ×1.4 ▰▰▰▱   │
│        sang            │ +46 XP            │
│ [sāng][sáng][sǎng][sàng]│ Reviews ▸ New ·  │
│ [   I don't know     ] │  Listen · Tones   │
│ ── sheet (column) ──   │ Space ▸ S ▸ 1–4   │
```
### Answer sheet
- Three levels max. Right: verdict row ("Right" + tick, +XP chip) → answer word with contour → Continue. Wrong: verdict row ("Not quite") → one line "It was **ěr ˇ**, you picked **ér ˊ**" with the two replay buttons inline at the end of that line → hanzi + gloss in small muted → Continue.
- The wrong pick shows its cinnabar outline and ✕ at the same moment the right option lights jade, in both the question and the sheet.
- The sheet never scrolls the page; the right answer is already in it.

### Session end
As built (stamp, condensed +XP, three numbers, level bar, weakest pair, medallion grid). The stamp is imperial.

### Tone Gym
Lead: **Workout plate** (jade, plate radius) with the weakest pair drawn as two large contour strokes in their colours, "1–3 · missed 33%", and the best score as a numeral. The separate grey weakest-pair box goes (it's in the plate). Even mix is a card row. The matrix follows; intro is one line; speaker credit under the matrix. On PC the plate and the matrix sit side by side in the shell (plate 1/2, matrix 1/2).

### Stats, phone and PC
Title, then **the tabs directly under it** (Overview · Words · Tones · Habits · Badges; sticky). The lead numbers sit inside Overview at its top. **The full matrix moves into the Tones tab**; Overview gets a one-line tone summary ("Weakest pair 1–3 ¯ˇ, missed 33%. Tone 3 is your lowest at 74%.") linking to Tones, a 30-day accuracy sparkline, the forecast and reviews coming up. PC: two columns that start at the same top line, each a white card.
```
Stats
[Overview][Words][Tones][Habits][Badges]
┌319 words│90% kept│23 days│Lv 15┐
 Weakest pair 1–3 ¯ˇ … → Tones
┌ Accuracy, 30 days ~~~~╱~ ┐┌ Reviews coming up ┐
┌ When do I get there?     ┐└──────────────────┘
```
### Library and Settings
Shell left edge, 720px content. Settings: four groups (Learning, Sound & display, Microphone, Data) as grouped lists; each row is a title in body ink and at most one muted line; longer explanations behind a "?" disclosure.

## 4. Motion and reward
- Curves: `--ease-out` arriving, `--ease-in` leaving, `--ease-spring` rewards only. Durations: micro 160 · std 240 · sheet 280 · exit 150 · celebration 600–900ms.
- **Sequence, never pile-up.** The picked option reacts first (0–160ms), the sheet rises after (from 120ms), sheet content is fully opaque by the time the sheet lands. Nothing semi-transparent over the options.
- **Right (every time):** the picked option fills jade-soft and pops (1.06, spring, 240ms) while a jade ring expands out of it and fades (320ms); the tick draws; the +XP chip springs in the sheet, then flies to the header XP counter (PC: the rail), which ticks up. One beat, about 600ms in all.
- **Wrong:** shake 6px × 4, ✕ draws, right option lights jade after 60ms. No sound or colour wash beyond that.
- **Combo:** chip pulses at 3, 5, 10, a step bigger each time; at 10 the header (rail on PC) glows imperial once.
- **Goal reached** (first time today): on returning Home the ring closes its last segment (600ms) and a small imperial 达标 seal stamps on it, once. **Streak +1**: the numeral rolls from 22 to 23 and the flame flickers once. Only one of the two plays; goal wins.
- **Level up / achievement:** as built (violet band, medallions 120ms apart).
- **Reduced motion:** no movement, scale or shake. The sheet appears in place instantly; only the content inside it fades in (120ms), so nothing ghosts over the options. Colour changes stay.

## 5. Copy voice
- Plain, short, sentence case, second person. Say the number: "Missed 1–3 a third of the time", not "Tones need work".
- Prompts are questions, not labels: "Which tone?", "What does it mean?".
- Actions name what happens: "Start quick session", "Play again", "Find my level".
- Rewards are brief and specific: "Level 16", "10 in a row ×2", "Goal reached".
- Misses don't scold: "Not quite. It was ěr, you picked ér."
- Empty states give the target: "The matrix fills in after 20 tone answers."

## 6. Avoid
- Red, orange, green or blue for anything but tones; tone colour without its contour at answer size.
- Cinnabar for stamps or decoration (the 学 logo is the one exception: Mikkel kept it); violet for anything that isn't earned.
- A third card look (sunk grey boxes) or a stack of equal white cards as a whole screen.
- Prompts in bold heading weight competing with the pinyin; controls between the audio and the syllable.
- PC pages with different left edges, a column floating centred in 1440px, or a session using half the width with nothing beside it.
- Lived-in users seeing first-week prompts (placement); new users seeing a promise with nothing behind it.
- Translucent layers over content during a transition; several things starting in the same 100ms.
- Generic confetti, emoji or gradient washes; uppercase tracked labels; middle-dot strings as the only structure.
