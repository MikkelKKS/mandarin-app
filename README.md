# Mandarin

A personal Mandarin app for one learner, aimed at a large vocabulary, at listening and at getting tones right. Pinyin first; characters are optional. It runs in the browser and installs as an app on phone and PC.

**[Open the app](https://mikkelkks.github.io/mandarin-app/)**

## What's in it

- **Home:** daily goal, streak (with freezes), level, and one main button: a **Quick session** (about 5 minutes, phone) or a **Deep session** (20+ minutes, PC).
- **Sessions:** due reviews first, then new words from the HSK 3.0 list (about 11,000 words) in frequency order, each with an example sentence; a deep session adds listening (dictation, "do you understand it?") and speaking.
- **Spaced repetition** with FSRS, scheduled separately per skill: listening → meaning, listening → pinyin, meaning → pinyin and speaking. "I don't know this word" sends a word back to new.
- **Pinyin typing** with tone numbers or marks (converted as you type); syllables and tones are scored separately.
- **Tone Gym** (Tones tab): single tones by six real speakers (Tone Perfect), all tone pairs and tone changes, weighted to your tone confusion matrix. Single-tone questions are also mixed into sessions.
- **Speaking:** record yourself and compare your pitch curve with the native one. The microphone can be turned off.
- **Library:** Conversations (29 units of dialogues set around family life in Beijing, with role-play), Stories (read aloud), Music (Spotify songs at your level, lyrics with pinyin), the full HSK word list (move words between stages) and the Dictionary (with "Learn next").
- **Stats:** words per HSK level and stage, true retention, a 14-day forecast, the tone confusion matrix, time, accuracy and XP per day, achievements.
- **Audio:** Azure neural voices (Xiaoxiao; Yunxi for men's lines), a 0.7× slow version of sentences, a 0.75 / 1 / 1.2 speed button, and "Report bad audio".
- Sync between phone and PC, offline use, dark mode. On PC: space = replay, s = slow, 1–4 = grade.

Everything you learn counts everywhere: a word learned in a Conversations lesson is a word in your sessions and Stats, and the other way round.

## Development

```bash
npm install
npm run dev               # local dev server
npm test                  # unit tests
npm run build             # production build
npm run test:e2e          # browser tests (phone and desktop sizes)
npm run content:validate  # check the Conversations units and stories
npm run vocab:build       # rebuild the HSK word and sentence data
```

## How it's put together

| Path | What's there |
|---|---|
| `src/` | The app (React, TypeScript, Tailwind, Dexie). See [ARCHITECTURE.md](ARCHITECTURE.md) |
| `content/` | Conversations units and stories ([CONTENT_GUIDE.md](content/CONTENT_GUIDE.md)), HSK word and sentence data |
| `scripts/` | Azure audio, vocabulary, dictionary and content scripts |
| `supabase/` | Database setup for sync, and the translation helper |
| `.github/workflows/` | Deploy, Azure audio (every 6 hours), vocabulary rebuild, translation helper |
| `docs/` | [One-time setup](docs/SETUP.md) |

Design decisions, with dates, are in [DECISIONS.md](DECISIONS.md).

## Credits

Tone recordings: [Tone Perfect MP3 Dataset](https://listings.lib.msu.edu/toneperfect/), Michigan State University Libraries (CC BY-NC 4.0), converted to mono MP3. HSK 3.0 vocabulary from [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT). Dictionary and glosses from [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0). Example sentences from [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR). Audio by Azure Speech. Pinyin data from [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT). Scheduling by [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT). Pitch detection by [pitchy](https://github.com/ianprime0509/pitchy) (MIT). Translation by Azure Translator, or [MyMemory](https://mymemory.translated.net/). Lyrics from [LRCLIB](https://lrclib.net), fetched on your device. Fonts: Instrument Sans and Noto Sans SC (SIL Open Font License).
