# CLAUDE.md — Mandarin learning app (redesign brief)

You are redesigning an existing personal Mandarin learning app for one user, Mikkel. This file is the product and design brief. Read it fully before touching code.

## 0. Context and ground rules

- **Repo:** `MikkelKKS/mandarin-app` (existing PWA, Supabase project already set up for sync). Read the current code first, keep what works, and migrate rather than rewrite from zero. Keep user progress if any exists.
- **Devices:** Windows PC (longer focused sessions, 20+ min) and Samsung Galaxy S25 (short bursts, 5–10 min). Both must work well; design mobile-first, but give PC a roomier layout and keyboard shortcuts.
- **Owner is not an experienced programmer.** When you need him to do something (create an API key, set an env var, run a script), give explicit numbered click-by-click steps. Commit straight to `main`; no pull requests.
- **Single user.** No public sign-up, no social features, no leaderboard against others.
- **Language of UI:** English. Meanings/glosses in English.

## 1. The learner

- Has some Mandarin basics and some speaking experience; wants to push into higher HSK levels.
- **Biggest weakness: tones** (hearing and producing them).
- Priorities: **listening** first, then speaking, and a **large vocabulary** (breadth matters more than a small set of polished sentences).
- **Pinyin only.** He does not want to learn to write characters. Do not build any stroke-order or handwriting features. Hanzi may be shown as an optional, off-by-default toggle, never required to answer anything.
- Girlfriend's family is from Beijing, so standard Putonghua with a Beijing flavour (儿化 / erhua) is relevant later — low priority, an optional content pack.
- Already owns Pleco (paid). No need to build a full dictionary; a "open in Pleco" deep link from a word is a nice touch.

## 2. What makes it fun for him (design drivers)

He chose **game mechanics** and **seeing stats & progress**. He did *not* pick stories or speed-run challenges as primary drivers, so keep those secondary.

- XP, levels, daily goal, streak (with a streak freeze so one missed day isn't crushing), achievements/badges for milestones (e.g. "500 words mature", "100 perfect tone pairs", "7-day streak").
- Combo multiplier for consecutive correct answers within a session.
- A rich **Stats** screen (he's an actuarial student — he will enjoy real numbers):
  - Words by state (new / learning / young / mature) and per HSK level, as progress bars.
  - True retention rate (last 7/30 days) vs target retention.
  - Review forecast for the next 14 days.
  - **Tone confusion matrix** (heard/typed tone vs correct tone, incl. tone-pair level, e.g. 2–3 vs 3–2) — this is the single most useful stat for him.
  - Time studied per day, accuracy trend, XP history.
- Session end screen: XP earned, accuracy, new words learned, weakest tone pair today.

## 3. Learning method (research-based)

### 3.1 Two engines: lessons + spaced repetition (he chose "both")
- **Lessons** introduce new words in small batches (default 5–10 new words, configurable), each word heard several times, in at least one example sentence, with a mix of exercise types.
- After a word is introduced, it enters an **SRS review queue** scheduled with **FSRS** (use the `ts-fsrs` npm package; Anki ships FSRS as an option since 23.10 and its open benchmark shows it beats SM-2 on prediction accuracy and needs fewer reviews for the same retention). Default desired retention 0.90; expose it in settings. Grading: Again / Hard / Good / Easy, but auto-grade from typed answers where possible (wrong → Again, right but slow or with a hint → Hard, right → Good; let him override).
- Daily flow: due reviews first, then new words, capped by daily limits. Store full review logs in Supabase so FSRS parameters can be optimised later (optional "Optimise my scheduler" button once ≥1000 reviews exist).
- Separate review "facets" per word so weak skills are scheduled independently:
  1. **Listening → meaning** (hear audio, choose/type English meaning)
  2. **Listening → pinyin** (dictation: hear audio, type pinyin with tones)
  3. **Meaning → pinyin** (see English, type pinyin with tones — active recall)
  4. **Speaking** (see English or pinyin, say it; mic optional — see §5)

### 3.2 Tone training (top priority feature: "Tone Gym")
Research on perceptual tone training (Wang et al. 1999/2003 and follow-ups) shows short, focused **high-variability** training (many different speakers and words) improves tone identification, generalises to new words and voices, carries over to production, and is retained months later. Training should also cover **two-syllable words**, because tones in context (coarticulation, sandhi) are harder than isolated syllables.
- **Minimal-pair / minimal-quad drills:** hear one syllable (e.g. má), pick which of mā/má/mǎ/mà it was. Use multiple speakers (male + female) — never a single voice.
- **Tone-pair drills:** all 20 two-syllable combinations (1-1 … 4-4, plus neutral tone), using real disyllabic words.
- **Tone sandhi** modules: 3-3 → 2-3, 不 and 一 changes, half-third tone. Canonical answer = dictionary tones; show the sandhi'd surface form as an explanation after answering.
- **Adaptive:** drill whatever the confusion matrix says is weakest (classically 2 vs 3 and 3 vs 4 for many learners). Feedback immediately after each item, replaying both the correct and the chosen sound.
- **Tone colours**, used consistently everywhere (pinyin text, buttons, pitch graphs): T1 red, T2 orange/yellow, T3 green, T4 blue, neutral grey. (Pleco-like; make it configurable.)
- Short sessions (2–3 min rounds of 20 items) with a score, so it fits phone bursts.

### 3.3 Vocabulary breadth
- Primary source: **HSK 3.0 vocabulary** (~11,000 terms across levels 1–6 and 7–9). Use `ivankra/hsk30` (MIT, cleaned CSV with pinyin, part of speech, CC-CEDICT keys) and/or `drkameleon/complete-hsk-vocabulary` (JSON with tone-mark and numeric pinyin, levels, classifiers). English glosses from **CC-CEDICT** (CC BY-SA).
- Let him set a starting level and run a quick **placement test** (listening + pinyin) to auto-mark already-known words as mature, so he isn't drilled on basics.
- Within a level, order new words by frequency.
- Every word gets at least one **short example sentence** (he wants breadth, so sentences are support, not the main unit). Prefer **Tatoeba** sentence pairs (CC BY); filter to sentences whose other words are mostly already known ("i+1"). Where none exists, generate one at build time (see §4) and mark it as generated.
- Optional topic tags/packs later (running, gaming, finance/insurance, university, family/Beijing).

### 3.4 Listening practice beyond single words
- **Dictation** of words and short sentences into pinyin (transcription is a well-known active-listening technique).
- **Speed ladder:** replay at 0.75× → 1.0× → 1.2×.
- **Sentence comprehension:** hear a sentence of known words, pick the meaning.
- Always a **replay** button and a **slow** button; keyboard shortcuts on PC (space = replay, s = slow).

## 4. Pinyin input (he chose "mostly typing")
- Accept **tone numbers** (`ni3 hao3`, `nǐ hǎo`, `ni3hao3`), convert to tone marks live as he types. `v` or `u:` → `ü`. Neutral tone as `5`, `0`, or no number.
- Ignore case, spaces, apostrophes and hyphens when comparing; normalise syllable segmentation.
- **Score syllables and tones separately** and show exactly which syllable/tone was wrong, colour-coded. Feed tone errors into the confusion matrix.
- Lenient mode toggle: syllables right but a tone wrong = "Hard" instead of "Again".
- Multiple-choice is only used for the very first exposure of a brand-new word and in Tone Gym; everything else is typing.
- On phone, offer a compact on-screen tone row (1 2 3 4 5) above the keyboard.

## 5. Speaking practice (mic, must be toggleable)
- Global setting "Use microphone" (default on), plus a per-session "no mic right now" toggle. When off, speaking facets are skipped (not failed) and not scheduled.
- Speaking exercise: play native audio → he records → show **both pitch contours** overlaid (native vs his), time-normalised, coloured by expected tone. Replay A/B. He self-grades.
- Pitch detection in-browser via Web Audio API + **`pitchy`** (McLeod Pitch Method, MIT-style licence, real-time capable) or `pitchfinder` (YIN). Smooth the contour, drop unvoiced frames, normalise pitch to his own range (semitones relative to his median) so male/female voices compare fairly.
- Phase 2 (optional): automatic tone classification of his recording (simple contour-shape heuristics per syllable) to suggest a grade. Never block on it.
- Record locally only; don't upload recordings unless he explicitly saves one.

## 6. Audio strategy (important — he dislikes bad TTS)

Never use the browser's built-in `speechSynthesis` except as a last-resort fallback flagged in the UI. Audio is **pre-generated or pre-downloaded at build time**, stored as files, and cached offline by the service worker. Tiered sources, best first:

1. **Real human recordings of every syllable × tone — "Tone Perfect"** (Michigan State University Libraries): all 410 Mandarin syllables in 4 tones by **6 native speakers (3 female, 3 male)**, ~9,840 files, free/open access. Ideal for Tone Gym (high-variability training). *Verify the licence on the site before bundling (believed to be non-commercial, no-derivatives — fine for this personal, non-commercial app if files are used unmodified with attribution). The site may block automated access; if so, give Mikkel step-by-step instructions to download it manually.*
2. **Real human sentence/word recordings where licences allow:** Tatoeba sentence audio (licence is per speaker — only use CC BY / CC BY-SA / CC0 items, store attribution) and Wikimedia Commons / Lingua Libre pronunciation files for words. Coverage for Mandarin is partial; use where available.
3. **High-quality neural TTS, generated once offline** for everything else (most words and sentences).
   - **DECIDED: Azure Speech** is the provider. Mikkel has an Azure account with a Speech resource on the **Free F0** tier (500,000 characters/month, never expires; requests are refused, not billed, once the quota is used), region `swedencentral` (West Europe was not accepting new customers). The key and region are read from a git-ignored `.env` as `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. If `.env` doesn't exist yet, give Mikkel step-by-step instructions to create it (where the file goes, exact contents, how to copy KEY 1 from Azure portal → his Speech resource → Keys and Endpoint). Never ask him to paste the key into chat or commit it.
   - **Chosen voices (Mikkel picked after listening):** `zh-CN-XiaoxiaoNeural` (female) and `zh-CN-YunxiNeural` (male). (Yunjian was tried first and dropped on 27 Oct 2026: it mispronounced too many sentences.) Use the default/general speaking style only — no emotional styles (cheerful, sad, etc.), since they exaggerate pitch and distort tones. Use SSML `<prosody rate>` for slow versions. Still produce the 30-item sample for approval before bulk generation.
   - Spread bulk generation over several months if needed to stay within 500k characters/month (CJK may count as 2 chars each). The script must track usage, stop before the quota, and resume the next month.
   - Fallback only if Azure fails: Google Cloud TTS Chirp 3: HD (`cmn-CN`), or open-source CosyVoice 3 run locally.
   - Rough budget: ~11k words + ~11k short sentences ≈ 150–350k billed characters (CJK may be billed as 2 chars each). Fits the free tiers; worst case a few dollars one-time. He prefers free, accepts a small one-time cost — **never set up anything with a recurring charge**, and set a billing alert/hard cap if a card is required.
   - Generate **two voices (one female, one male)** per item for variability, plus a 0.8× slow version for sentences. Feed the tool **hanzi with explicit pinyin/phoneme hints** (SSML `<phoneme alphabet="sapi">` or equivalent) for polyphonic characters and neutral tones, then spot-check.
4. **Quality control:** a "report bad audio" button on every item → queue in Supabase → a script regenerates flagged items with another voice. Before bulk generation, produce a 30-item sample set (including tricky items: 3-3 sandhi, neutral tones, 儿化, polyphones like 行/长/了) and ask Mikkel to approve the voice choice.

Storage: Opus (or MP3 fallback) at 48–64 kbps mono in Supabase Storage (or the repo if small enough), named by a stable ID. Service worker pre-caches the current level and due items so phone sessions work offline.

Write the generation as a **Node or Python script in `/scripts`**, idempotent (skips existing files), with API keys read from a local `.env` that is git-ignored. Never commit keys.

## 7. Session design
- **Phone "Quick session" (default ~5 min):** due reviews, interleaved with a short Tone Gym round. One big button on the home screen.
- **PC "Deep session" (20+ min):** reviews → new-word lesson → listening/dictation block → speaking block (if mic on) → Tone Gym. Show progress through the blocks.
- Home screen: streak, daily goal ring, due count, "Start" buttons, weakest tone pair of the week.
- Resume an interrupted session on either device (sync via Supabase; local-first with IndexedDB, sync when online, last-write-wins per review log entry — review logs are append-only so conflicts are rare).

## 8. Ideas borrowed from existing tools
- **Anki:** FSRS, honest grading, review forecast, card facets.
- **Duolingo / HelloChinese:** bite-sized lessons, XP, streaks, daily goal, satisfying feedback animations and sounds.
- **ToneDeck / TonePerfect apps / Picky Birds:** dedicated tone ear-training, minimal pairs, tone-pair drills, tone colours, per-tone accuracy stats.
- **ToneDetector / Harvard "Mandarin Tone Trainer":** pitch contour of your voice overlaid on a native speaker's.
- **Pleco:** tone colours, deep link out for full dictionary info.
- **Hacking Chinese (Olle Linge):** tones matter more than learners think; transcription/dictation as active listening; neutral tone and 3rd-tone guidance.
- **Clozemaster/Tatoeba-based tools:** words in real example sentences, filtered to known vocabulary.

## 9. Out of scope
Character writing/handwriting, stroke order, social features, ads, paid subscriptions, user accounts beyond Mikkel's.

## 10. Suggested build order
1. Audit existing repo; write a short `ARCHITECTURE.md` of what exists.
2. Data pipeline: HSK 3.0 + CC-CEDICT + Tatoeba → one `words.json` / `sentences.json` with stable IDs.
3. Pinyin input + normaliser + scorer (with unit tests — this is the core of every exercise).
4. FSRS review engine + review log + Supabase sync.
5. Audio: 30-item sample for approval → bulk generation script → service-worker caching. Integrate Tone Perfect for Tone Gym.
6. Tone Gym + confusion matrix.
7. Lessons, quick/deep sessions, XP/streak/achievements.
8. Stats screen.
9. Speaking with pitch contours (toggleable).
10. Placement test, polish, optional erhua/Beijing pack.

After each step: deploy, then tell Mikkel in plain language what changed and what (if anything) he needs to do, step by step.

## 11. Definition of done for the redesign
- He can do a 5-minute phone session and a 25-minute PC session with no crashes, offline-capable, synced between devices.
- Every word has natural-sounding audio (no browser TTS) and a typed-pinyin exercise that grades tones separately.
- Tone Gym uses multiple real/neural speakers and adapts to his confusion matrix.
- Stats screen shows retention, forecast, words per HSK level, and the tone confusion matrix.
- Microphone features can be turned off globally and per session.
