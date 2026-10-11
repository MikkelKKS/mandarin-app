import { go } from '../../lib/router';

const CREDITS: Array<{ name: string; what: string; licence: string; url: string }> = [
  { name: 'HSK vocabulary lists', what: 'HSK levels for vocabulary (drkameleon/complete-hsk-vocabulary)', licence: 'MIT', url: 'https://github.com/drkameleon/complete-hsk-vocabulary' },
  { name: 'CC-CEDICT', what: 'Chinese–English dictionary data (used for look-ups as the dictionary grows)', licence: 'CC BY-SA 4.0', url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict' },
  { name: 'pinyin-pro', what: 'Pinyin conversion and the syllable list', licence: 'MIT', url: 'https://github.com/zh-lx/pinyin-pro' },
  { name: 'ts-fsrs', what: 'Spaced-repetition scheduling', licence: 'MIT', url: 'https://github.com/open-spaced-repetition/ts-fsrs' },
  { name: 'Microsoft neural voices via edge-tts', what: 'Generated speech audio (Xiaoxiao, Yunxi)', licence: 'see the edge-tts repository; voices by Microsoft', url: 'https://github.com/rany2/edge-tts' },
  { name: 'Noto Sans SC', what: 'Chinese typeface', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+SC' },
  { name: 'Lexend', what: 'Interface typeface', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Lexend' },
  { name: 'React, Vite, Tailwind CSS, Dexie, Zod', what: 'App framework and tools', licence: 'MIT / Apache-2.0', url: 'https://github.com/MikkelKKS/mandarin-app/blob/main/package.json' },
];

export function About() {
  return (
    <div className="pb-10">
      <button onClick={() => go('settings')} className="mb-4 text-sm text-muted">
        ← Settings
      </button>
      <h1 className="text-2xl font-bold">About</h1>
      <p className="mt-2 text-muted">
        A personal Mandarin app, focused on understanding spoken Chinese and knowing what to say. All sentences and stories are written for this app. No limits, no ads,
        no tracking.
      </p>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">Credits & licences</h2>
      <ul className="flex flex-col gap-2">
        {CREDITS.map((c) => (
          <li key={c.name} className="rounded-2xl bg-surface p-4">
            <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-2 hover:underline">
              {c.name}
            </a>
            <p className="text-sm text-muted">{c.what}</p>
            <p className="text-sm">Licence: {c.licence}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
