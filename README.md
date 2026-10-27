# Mandarin

A listening-first Mandarin Chinese course that runs in the browser and installs as an app on phone and desktop. Short lessons on an unlockable skill path, everyday conversations, and no limits on practice.

**[Open the app](https://mikkelkks.github.io/mandarin-app/)**

## Features

- **Home**: daily goal ring, streak (with freezes), level and XP, reviews due, and one big button for a **Quick session** (about 5 minutes, phone) or a **Deep session** (20+ minutes, PC).
- **Large vocabulary**: the whole HSK 3.0 list (about 11,000 words), new words in frequency order, each with an example sentence. A **placement test** or a chosen starting level skips what you already know.
- **Spaced repetition** with FSRS, scheduled separately per skill: listening → meaning, listening → pinyin (dictation), meaning → pinyin, and speaking.
- **Pinyin typing** with tone numbers or marks (live conversion), syllables and tones scored separately, strict tones by default.
- **Tone Gym**: single tones, all tone pairs, and sandhi, adapting to your tone confusion matrix.
- **Speaking**: record yourself and compare your pitch curve with the native one (mic can be turned off).
- **Audio**: natural Azure neural voice (Xiaoxiao), a 0.7× slow version, a 0.75/1/1.2 speed button, and a "report bad audio" button.
- **Stats**: words per HSK level and state, true retention, 14-day forecast, tone confusion matrix, time, accuracy and XP per day.
- **Conversations**: the original 29 themed units set around family life in Beijing, with stories and role-play. Optional **Beijing pack** puts those words first.
- **Music, mini-games, dictionary** (with Pleco links), sync between devices, offline support, dark mode.
- PC keyboard: space = replay, s = slow, 1–4 = grade.

## Development

```bash
npm install
npm run dev               # local dev server
npm test                  # unit tests
npm run build             # production build
npm run test:e2e          # end-to-end tests (phone and desktop sizes)
npm run content:validate  # check all lesson content
```

Audio is generated with Azure Speech by `scripts/azure-tts.ts`, run by the GitHub workflow `azure-audio.yml` every 6 hours (it stops before the monthly free quota and carries on the next month). Keys are GitHub secrets (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `SUPABASE_SERVICE_KEY`), never committed.

## Project layout

| Path | What's there |
|---|---|
| `content/` | Course content (one file per unit), see [CONTENT_GUIDE.md](content/CONTENT_GUIDE.md) |
| `src/` | The app (React, TypeScript, Tailwind, Dexie) |
| `scripts/` | Audio generation, content validation, dictionary and HSK data |
| `supabase/` | Database setup for sync |
| `docs/` | [One-time setup](docs/SETUP.md) for hosting and sync |

Design decisions are recorded in [DECISIONS.md](DECISIONS.md).

## Credits

Dictionary data from [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0). HSK word levels from [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT). Pinyin data from [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT). Scheduling by [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT). Translation by [MyMemory](https://mymemory.translated.net/). Lyrics from [LRCLIB](https://lrclib.net), fetched on your device. Fonts: Noto Sans SC and Lexend (SIL Open Font License).
