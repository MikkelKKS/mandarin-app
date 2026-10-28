import { PageHeader } from '../../components/PageHeader';

const CREDITS: Array<{ name: string; what: string; licence: string; url: string }> = [
  { name: 'HSK vocabulary lists', what: 'HSK levels for vocabulary (drkameleon/complete-hsk-vocabulary)', licence: 'MIT', url: 'https://github.com/drkameleon/complete-hsk-vocabulary' },
  { name: 'CC-CEDICT', what: 'Dictionary data', licence: 'CC BY-SA 4.0', url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict' },
  { name: 'Tatoeba', what: 'Example sentences (with their authors credited in the data)', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org' },
  { name: 'Azure Translator', what: 'Sentence translation in the dictionary, when set up', licence: 'Microsoft Azure terms', url: 'https://azure.microsoft.com/products/ai-services/ai-translator' },
  { name: 'MyMemory', what: 'Sentence translation otherwise', licence: 'free API, see their terms', url: 'https://mymemory.translated.net/doc/spec.php' },
  { name: 'pitchy', what: 'Pitch detection for speaking practice', licence: 'MIT', url: 'https://github.com/ianprime0509/pitchy' },
  { name: 'pinyin-pro', what: 'Pinyin conversion and the syllable list', licence: 'MIT', url: 'https://github.com/zh-lx/pinyin-pro' },
  { name: 'ts-fsrs', what: 'Spaced-repetition scheduling', licence: 'MIT', url: 'https://github.com/open-spaced-repetition/ts-fsrs' },
  { name: 'Tone Perfect (Michigan State University Libraries)', what: 'Every Mandarin syllable in all four tones by six native speakers, used for single tones in the Tone Gym and sessions. Converted to mono MP3.', licence: 'CC BY-NC 4.0', url: 'https://listings.lib.msu.edu/toneperfect/' },
  { name: 'Azure AI Speech', what: 'Speech audio (voices Xiaoxiao and Yunxi), generated once and stored', licence: 'Microsoft Azure terms', url: 'https://azure.microsoft.com/products/ai-services/text-to-speech' },
  { name: 'Microsoft neural voices via edge-tts', what: 'Older speech audio, used until the Azure recordings replace it', licence: 'see the edge-tts repository; voices by Microsoft', url: 'https://github.com/rany2/edge-tts' },
  { name: 'Noto Sans SC', what: 'Chinese typeface', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+SC' },
  { name: 'Instrument Sans', what: 'Interface typeface', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Instrument+Sans' },
  { name: 'React, Vite, Tailwind CSS, Dexie, Zod', what: 'App framework and tools', licence: 'MIT / Apache-2.0', url: 'https://github.com/MikkelKKS/mandarin-app/blob/main/package.json' },
];

export function About() {
  return (
    <div className="pb-10">
      <PageHeader back={{ label: 'Settings', to: 'settings' }} title="About" />
      <p className="mt-2 text-muted">
        A personal Mandarin app for a large vocabulary, listening and tones. The Conversations units and the stories are written for this app; the other example sentences
        come from Tatoeba. No ads, no tracking.
      </p>
      <h2 className="mb-2 mt-8 px-1 text-sm font-medium text-muted">Credits and licences</h2>
      <ul className="group-list">
        {CREDITS.map((c) => (
          <li key={c.name} className="px-4 py-3.5">
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
