# Mandarin

A personal Mandarin app for Mikkel: listening first, then knowing what to say, writing pinyin and reading some characters. Skill path, bite-sized lessons, no limits. Installable on PC and phone, works offline.

**Live app:** https://mikkelkks.github.io/mandarin-app/

## What's in it now

- A skill path: *Check your basics* plus three HSK 1 units (Greetings & introductions, Family, Food & drink). Each unit ends with a listening story.
- 14 exercise types: listening (meaning, which sentence, word tiles, dictation, tones, minimal pairs, "What would you say?"), pinyin writing (English → pinyin, fill the gap, sentence building, typed replies) and character recognition (match pairs, pick the character, read the sentence).
- Pinyin answers accept tone marks or numbers, `v`/`u:` for ü, and any spacing. They are lenient about 不/一 and 3rd-tone changes, and missing tones count as "almost".
- Spaced repetition (FSRS) and a **Practice** button for due reviews and recent mistakes.
- Test-outs for every unit, tips cards, tap-any-word look-ups, tone colours, dark mode, and "Can't listen now".

Coming next (see CLAUDE.md §11): sync between devices (phase 4), mini-games (5), more units (6), AI practice packs (7), optional speaking (8).

## Things you (Mikkel) need to do

### Now: turn on GitHub Pages (once)
1. Open https://github.com/MikkelKKS/mandarin-app/settings/pages
2. Under **Build and deployment → Source**, pick **GitHub Actions**.

From then on, every change pushed to `main` is published automatically in about 3–5 minutes. You can watch the progress at https://github.com/MikkelKKS/mandarin-app/actions

### Install it on your phone and PC
- **Samsung S25 (Chrome or Samsung Internet):** open the live app link, tap the menu (⋮) → **Add to Home screen / Install app**.
- **PC (Chrome or Edge):** open the link and click the install icon at the right end of the address bar, or menu → **Install Mandarin**.
- Open the app once while online. After that, lessons work offline, and audio for unlocked units downloads in the background.

### Sync between phone and PC (Supabase, free)
1. Create a free project at https://supabase.com (sign in with GitHub → **New project** → region in Europe → **Free**).
2. **Authentication → URL Configuration:** set **Site URL** to `https://mikkelkks.github.io/mandarin-app/`. Under **Redirect URLs**, add `https://mikkelkks.github.io/mandarin-app/**`.
3. **SQL Editor → New query:** paste all of `supabase/migrations/001_init.sql` and press **Run**. It's safe to run again.
4. Put the **Project URL** and the **anon / publishable key** in `.env.production` (`VITE_SUPABASE_URL=…`, `VITE_SUPABASE_ANON_KEY=…`) and push. These two values are public by design: your data is protected by the row-level security rules in the SQL.
5. In the app: **Settings → Sync between devices**, enter your email, and tap the link in the email **on the same device**. Do this once on the phone and once on the PC.

**Supabase pauses free projects after about a week without use.** The app keeps working offline on each device. To sync again, open https://supabase.com/dashboard, pick the project and press **Resume project**. Everything catches up on the next sync.

Optional, to sign in with a code instead of the link: **Authentication → Emails → Magic Link** template, add `{{ .Token }}` to the email body. The app has a box for the code.

## Ask a native speaker
`content/REVIEW_NEEDED.md` lists a few phrases to double-check, including the Chinese version of your name.

---

## For developers (and future Claude sessions)

```bash
npm install
npm run dev                 # local dev server
npm test                    # unit tests (pinyin checking, FSRS, progress, content, generator)
npm run content:validate    # schema + cross-references + pinyin vs characters + audio files
npm run build && npm run test:e2e   # Playwright smoke test at 375px and desktop
pip install edge-tts && npm run audio:generate   # generate missing MP3s
npm run hsk:fetch           # refresh the HSK level index from the open list
```

- Content lives in `/content` (one file per unit). See `content/CONTENT_GUIDE.md`.
- Design and scope decisions are logged in `DECISIONS.md`.
- CI (`.github/workflows/deploy.yml`) generates missing audio with edge-tts and commits it, then validates, tests, builds and deploys to GitHub Pages.
- Audio is generated with edge-tts, an unofficial interface to a free Microsoft service that could break. The MP3s are committed, so the app never depends on it at runtime. If generation fails, existing audio keeps working, and the app falls back to the browser's own speech for anything missing.

### Credits
Listed in the app under Settings → About (names, links and licences): HSK vocabulary list by drkameleon (MIT), CC-CEDICT (CC BY-SA 4.0), pinyin-pro (MIT), ts-fsrs (MIT), Noto Sans SC and Lexend (SIL OFL 1.1), and Microsoft neural voices via edge-tts.
