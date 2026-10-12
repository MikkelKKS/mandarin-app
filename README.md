# Mandarin

A listening-first Mandarin Chinese course that runs in the browser and installs as an app on phone and desktop. Short lessons on an unlockable skill path, everyday conversations, and no limits on practice.

**[Open the app](https://mikkelkks.github.io/mandarin-app/)**

## Features

- **Skill path** covering all HSK 1–3 vocabulary in 29 themed units, set around family life in Beijing: greetings, food, shopping, phone calls, school, moving in, seasons, festivals, feelings and more. Every unit ends with a listening story, and every unit has a test-out.
- **Beijing flavour**: the -r sound (哪儿, 一会儿), 咱们, 您 for elders and local words, alongside standard Mandarin.
- **Role-play**: take one part in any story and type your lines while the other person speaks.
- **Listening first**: about half of each lesson is audio, recorded with natural neural voices, with a slow version of every sentence.
- **Conversation practice**: hear what someone says and pick or type the right reply. Lots of typing whole sentences, using new words in context.
- **Pinyin typing** with tone marks or numbers, lenient about tone changes, with clear feedback on tones.
- **Tone training**: tone exercises in every lesson, plus the Tone Sort and Tone Pairs games.
- **Spaced repetition** (FSRS) for reviews and recent mistakes.
- **Progress**: HSK coverage, reviews coming up, how well you hear each tone, and the words that trip you up.
- **Music**: connects to Spotify, finds Mandarin songs in the genres you like, scores the lyrics against what you know, saves a playlist at your level, and shows the lyrics with pinyin as you listen.
- **Mini-games**: Tone Sort, Tone Pairs, Listening Blitz, Pair Rush, Sentence Scramble, Measure Word Match.
- **Dictionary**: search by characters, pinyin or English, sentence breakdown, online translation, Pleco links, and "add to practice".
- **AI practice packs**: export your weak spots, generate a targeted pack with Claude, and import it.
- **Sync** between devices, offline support, backups, dark mode.

## Development

```bash
npm install
npm run dev               # local dev server
npm test                  # unit tests
npm run build             # production build
npm run test:e2e          # end-to-end tests (phone and desktop sizes)
npm run content:validate  # check all lesson content
```

Audio is generated with [edge-tts](https://github.com/rany2/edge-tts) (`pip install edge-tts`, needs `ffmpeg`): `npm run audio:generate`. The deploy workflow does this automatically for anything new.

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
