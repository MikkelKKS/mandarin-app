# CLAUDE.md — Mandarin Learning App ("Game-style, no limits")

This file is the brief for building a personal Mandarin Chinese learning app. Read it fully before writing code. When something here conflicts with your own preference, follow this file; when something is unspecified, choose the simplest option that fits the principles below and note the choice in `DECISIONS.md`.

---

## 1. Goal and owner

- **Single user:** Mikkel (Denmark). Personal app, not a commercial product. No multi-tenant features, no social features, no ads, no payments.
- **Current level:** knows some basics (pinyin, greetings, a handful of words). Not a complete beginner, but has no formal HSK level yet.
- **UI and explanation language:** English.
- **Learning priorities, in order:**
  1. **Understanding spoken Mandarin** (listening comprehension) — the top priority.
  2. **Conversational ability** — knowing what to say in everyday situations. Practised mainly through listening, choosing responses and typing them, not through heavy speaking (see §5).
  3. **Writing in pinyin** (typing sentences in pinyin with tones).
  4. **Reading some characters** (recognition only — no handwriting or stroke-order practice).
- **Feel:** fun and game-like, built around short bite-sized lessons and an unlockable skill path.
- **Hard rule: no attempt limits.** No hearts, lives, energy, cooldowns, daily caps or paywalls. Every lesson, mini-game and review can be replayed any number of times.

## 2. Hard constraints

- **Zero running cost.** No paid APIs, no paid hosting, no paid TTS or speech services. Everything must work on free tiers or fully client-side.
- **No runtime LLM calls.** The owner has a Claude Pro subscription only — that does **not** include API access, and he does not want to buy API keys. AI is used *at development time* (you, the coding agent, generating content) and via a manual "practice pack" loop (§7), never from inside the running app.
- **Runs on PC and phone, synced.** Built as a **PWA**, installable from the browser on both.
- **Works offline** for all lessons and reviews already downloaded; syncs when back online.

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| App framework | Vite + React + TypeScript (strict) | |
| PWA | `vite-plugin-pwa` (Workbox) | Precache app shell, content JSON and audio for unlocked units |
| Styling | Tailwind CSS | Mobile-first; must feel good at 375px wide and on a desktop |
| Local storage | Dexie (IndexedDB) | Source of truth on each device; offline-first |
| Sync + auth | Supabase free tier | Email magic-link login, Postgres, Row Level Security |
| Spaced repetition | `ts-fsrs` | Scheduling of review items |
| Pinyin handling | `pinyin-pro` | Tone-mark ↔ tone-number conversion, normalization |
| Audio (primary) | Pre-generated MP3s via `edge-tts` (Python, free) at build time | zh-CN neural voices; use ≥2 voices (male/female) for variety |
| Audio (fallback) | Browser `speechSynthesis` with a zh-CN voice | Only if an MP3 is missing |
| Speech recognition (optional feature) | Browser Web Speech API (`webkitSpeechRecognition`, `lang: zh-CN`) | Free; feature-detect and hide if unsupported |
| Tone feedback (optional feature) | Client-side pitch detection (e.g. `pitchy`) | Draw the user's pitch contour against the target tone |
| Dictionary data | CC-CEDICT | CC BY-SA licence — include attribution in an About screen |
| Validation | `zod` | Schemas for all content files |
| Tests | Vitest (logic), Playwright (key flows at mobile + desktop viewport) | |
| Hosting | Vercel, Netlify or GitHub Pages (free) | Static deploy |

Notes:
- `edge-tts` is an unofficial interface to a free Microsoft service and could break. Generated MP3s are committed/stored as static assets so the app never depends on it at runtime. Keep the generation script re-runnable.
- Supabase free projects **pause after ~1 week of inactivity**. The app must keep working locally while paused and sync once the project is resumed. Mention this in the README.
- iOS Safari PWAs have quirks (audio needs a user gesture, storage can be evicted). Test on iOS and Android-class viewports; never autoplay audio before the first tap.

## 4. Curriculum and content model (hybrid)

### Structure
- **Fixed skeleton** aligned to HSK levels 1–3 (vocabulary and grammar), organized as a progression path:
  `Section → Unit → Skill node → Lessons`.
- Start with a **"Check your basics" unit** that can be tested out of, since the owner already knows some basics. Every unit offers a **test-out** option to jump ahead.
- Units are themed around real conversations: greetings & introductions, numbers & time, ordering food, shopping & prices, directions & transport, family, hobbies, work/study, plans & invitations, health, travel, etc.
- Each unit ends with a **listening dialogue story**: a short conversation (audio first, characters + pinyin + English revealed on demand) followed by comprehension questions.

### Content files
- All content lives in `/content` as JSON, validated by zod schemas in `/src/content/schema.ts`.
- `npm run content:validate` must pass in CI; it checks schema, that every referenced word exists in the vocabulary file, that every audio file exists, and that tone marks/pinyin are consistent with the characters.
- Core entities:
  - `Word`: id, hanzi, pinyin (tone marks), pinyin numeric, English gloss(es), HSK level, part of speech, example sentence ids, audio file.
  - `Sentence`: id, hanzi, pinyin, English, word ids (tokenized), audio files (normal + slow), alternative accepted English/pinyin answers.
  - `Dialogue`: id, speakers, lines (each a Sentence ref), comprehension questions.
  - `GrammarNote`: short English explanation + examples, shown as an optional "tips" card before a skill.
  - `Lesson`: ordered list of exercise specs referencing words/sentences.
- **Content is generated by you (the coding agent) during development**, then reviewed for correctness. Prefer natural, everyday Mainland Mandarin. Use simplified characters. Avoid overly textbook-stiff phrasing. Flag any sentence you are unsure about in `content/REVIEW_NEEDED.md` rather than shipping it silently.
- Write a `content/CONTENT_GUIDE.md` describing how to add new units so future sessions can extend the curriculum consistently.

## 5. Exercise types

Weight lessons roughly: **~50% listening, ~25% pinyin writing/sentence building, ~15% character recognition, ~10% other**. Speaking exercises are optional and off by default (see below).

### Listening (highest priority)
1. **Listen → pick meaning** (English options).
2. **Listen → pick the sentence** (hanzi+pinyin options, pinyin can be hidden by setting).
3. **Listen → tap the words in order** (word tiles).
4. **Dictation in pinyin** — hear a word/short sentence, type it in pinyin.
5. **Tone identification** — hear a syllable/word, pick the tone(s).
6. **Minimal pairs** — distinguish similar sounds (zh/z, q/ch, x/sh, ü/u) and tone pairs.
7. **Dialogue comprehension** — listen to a short conversation, answer questions.
8. **"What would you say?"** — hear a line in a conversation, choose or type the appropriate reply. This is the main way conversational ability is trained without speaking.

All audio exercises: replay button (unlimited), **slow-speed** button, and the option to reveal the transcript after answering.

### Writing in pinyin
9. **English → type pinyin** (word or sentence).
10. **Fill the gap** in a Chinese sentence by typing pinyin.
11. **Sentence building** with tiles (English prompt → arrange Chinese tiles).

Pinyin input rules (put this logic in one well-tested module, `src/lib/pinyinAnswer.ts`):
- Accept tone marks (`nǐ hǎo`), tone numbers (`ni3 hao3`), and `v` or `u:` for `ü`.
- Ignore case, extra spaces, and punctuation; accept with or without spaces between syllables.
- Neutral tone: accept `5`, `0` or no number.
- Apply sandhi leniency: accept both the citation tone and the spoken tone for 不/一 and third-tone sandhi.
- **Missing tones** count as "almost correct": show the correct tones and mark it as a soft error (setting: strict / lenient tones).
- Accept the alternative answers listed in content; give a "typo" pass for 1-character mistakes on long sentences, showing the correction.
- Provide an on-screen tone helper (buttons for ā á ǎ à ü) for mobile keyboards.

### Character recognition
12. **Match pairs** — hanzi ↔ pinyin, hanzi ↔ meaning.
13. **Pick the character** for a given pinyin/meaning.
14. **Read the sentence** — sentence shown in hanzi (pinyin hidden), pick the meaning.
- No handwriting, no stroke-order tracing.
- Tapping any hanzi shows a popup with pinyin, meaning and an audio button.

### Speaking (optional, off by default)
15. **Repeat after me** — the user says the phrase; Web Speech API transcribes; compare the transcript to the target and show a pitch-contour overlay for tones. Feedback is informational, never blocks progress.
- **Global setting:** "Speaking exercises: Off / On" (default **Off**).
- **Per-session button:** "Can't speak now" — skips/suppresses speaking exercises for the next hour.
- If the browser lacks speech recognition, the setting is shown as unavailable with a short explanation.
- Similarly provide "Can't listen now" (skip audio-only exercises for an hour) for quiet situations without headphones — swap them for reading exercises.

## 6. Game design

The owner chose **skill path + mini-games**. Do **not** add XP, streaks, leagues, gems, hearts or daily goals unless he asks later.

### Skill path
- Vertical, scrolling path of nodes per unit. Nodes unlock in order; test-outs let him jump.
- Each node has a few levels of mastery (e.g. 0–5, shown as a filling ring). Replaying a completed node is always allowed and counts towards mastery.
- A **"Practice" button** is always available: pulls due items from the FSRS queue plus recent mistakes.
- Lesson flow: ~10–15 exercises, progress bar at top, instant feedback after each answer (correct sound/animation, or shows the right answer with a "Got it" button). Wrong items are re-queued at the end of the same lesson.
- End-of-lesson screen: accuracy, time, new words learned, words to review. Keep it satisfying (small animation, sound) but without points/streak systems.
- Sound effects with a mute toggle.

### Mini-games (accessible from a "Games" tab, unlimited plays, each has a personal best)
- **Tone Sort** — syllables fall/appear; sort them into tone 1–4/neutral buckets by ear.
- **Listening Blitz** — rapid audio → meaning rounds against a timer.
- **Pair Rush** — timed hanzi/pinyin/meaning match grid.
- **Sentence Scramble** — build sentences from tiles under time pressure.
- **Measure Word Match** — pick the right measure word (个, 本, 张, 只, 杯…).
- Games draw only from words he has already unlocked, biased towards weak and due items.
- Games update FSRS review data too (so play counts as study).

## 7. The "AI practice pack" loop (hybrid without API)

Since the app cannot call an LLM, adaptivity works through an export/import loop the owner runs manually with his Claude subscription:

1. In the app: **Settings → Export weak spots** produces a JSON file (and a copy-to-clipboard prompt) listing his weakest words, confused tone pairs, grammar points with high error rates, and recently missed sentences.
2. He pastes this into Claude (claude.ai or Claude Code) along with the prompt template stored in `content/practice-pack-prompt.md`.
3. Claude returns a **practice pack JSON** that follows the content schema (new sentences, a dialogue, targeted exercises).
4. In the app: **Import practice pack** validates it with zod, generates audio via browser TTS fallback (no build step needed) and adds it as a "Custom practice" node at the top of the path.

Requirements:
- Write `content/practice-pack-prompt.md` with a precise prompt + schema excerpt + one example so Claude reliably returns valid JSON.
- Invalid packs show clear, specific validation errors.
- Imported packs sync to his other device via Supabase.

## 8. Sync and data model

- **Offline-first:** all user state lives in Dexie; a sync worker pushes/pulls to Supabase when online and logged in.
- Synced tables (all with `user_id`, `updated_at`, RLS restricting to owner):
  - `progress` — node mastery, unlocked units, test-out results.
  - `review_items` — FSRS card state per word/sentence.
  - `review_logs` — append-only answer log (used for weak-spot export and stats).
  - `settings` — speaking on/off, pinyin display mode, audio speed, tone strictness, sound on/off.
  - `custom_packs` — imported practice packs.
  - `game_scores` — personal bests.
- Conflict policy: last-write-wins per row by `updated_at`; `review_logs` are append-only and merged by id; mastery takes the max.
- Static curriculum content and audio are **not** stored in Supabase — they ship with the app.
- Login via email magic link; the app is fully usable before login (local only) and merges local progress into the account on first login.
- Provide a manual **Export / import full backup** (JSON) as a safety net.

## 9. Settings

- Speaking exercises: Off (default) / On
- Pinyin above characters: Always / Only on tap / Never
- Tone strictness: Lenient (missing tones = soft error) / Strict
- Audio speed default: Normal / Slow
- Voice: alternate / prefer male / prefer female
- Sound effects on/off
- Export weak spots, import practice pack, backup/restore, sign in/out

## 10. Project structure (suggested)

```
/content            curriculum JSON, audio manifest, CONTENT_GUIDE.md, practice-pack-prompt.md
/public/audio       generated MP3s (by content id)
/scripts            generate-audio.py (edge-tts), validate-content.ts, build-dictionary.ts
/src/content        zod schemas, content loader
/src/lib            pinyinAnswer.ts, fsrs wrapper, sync engine, audio player, speech, pitch
/src/features       path, lesson, exercises/*, games/*, review, settings, packs
/src/db             Dexie schema + migrations
/supabase           SQL migrations + RLS policies
```

## 11. Build phases

Work in this order; each phase should end with a deployable, working app.

1. **Foundation:** Vite/React/TS/Tailwind PWA, Dexie schema, content schema + validator, audio generation script, routing, install prompt.
2. **Core loop:** skill path UI, lesson player, listening + pinyin + recognition exercise types, `pinyinAnswer.ts` with thorough tests, end-of-lesson screen. Content: "Check your basics" + first 3 HSK1 units.
3. **Review:** FSRS integration, Practice button, mistake re-queueing.
4. **Sync:** Supabase auth + tables + RLS, sync engine, backup export/import.
5. **Mini-games:** Tone Sort, Listening Blitz, Pair Rush first; then the rest.
6. **Content expansion:** remaining HSK 1–3 units and dialogue stories.
7. **Practice-pack loop:** weak-spot export, prompt file, pack import.
8. **Optional speaking:** repeat-after-me with Web Speech API + pitch contour; "Can't speak / listen now".

## 12. Quality bar

- Every exercise must be completable on a phone with one thumb and on a PC with keyboard only (Enter to check/continue, number keys to pick options, space to replay audio).
- Never autoplay audio without a prior user gesture; preload the next exercise's audio.
- Lighthouse PWA installable; app loads offline after first visit.
- Unit tests for pinyin answer checking, FSRS scheduling wrapper, sync conflict merging, and content validation.
- Playwright smoke test: complete a lesson on a 375px viewport and on desktop.
- Accessible contrast, dark mode support, readable hanzi (large font, a font with good CJK coverage such as Noto Sans SC).

## 13. Things the owner must do (list these in the README)

- Create a free Supabase project and put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
- Run the SQL migrations in `/supabase`.
- Deploy to a free static host and open the URL on PC and phone; "Install app" / "Add to Home Screen".
- If Supabase has paused from inactivity, resume it in the dashboard.
