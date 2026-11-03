import { useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { useVocab } from '../../lib/vocabData';

const CREDITS: Array<{ name: string; what: string; licence: string; url: string }> = [
  { name: 'HSK vocabulary lists', what: 'HSK levels for vocabulary (drkameleon/complete-hsk-vocabulary)', licence: 'MIT', url: 'https://github.com/drkameleon/complete-hsk-vocabulary' },
  { name: 'CC-CEDICT', what: 'Dictionary data', licence: 'CC BY-SA 4.0', url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict' },
  { name: 'Tatoeba', what: 'Example sentences (with their authors credited in the data)', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org' },
  { name: 'Azure Translator', what: 'Sentence translation in the dictionary, when set up', licence: 'Microsoft Azure terms', url: 'https://azure.microsoft.com/products/ai-services/ai-translator' },
  { name: 'MyMemory', what: 'Sentence translation otherwise', licence: 'free API, see their terms', url: 'https://mymemory.translated.net/doc/spec.php' },
  { name: 'pitchy', what: 'Pitch detection for speaking practice', licence: 'MIT', url: 'https://github.com/ianprime0509/pitchy' },
  { name: 'pinyin-pro', what: 'Pinyin conversion and the syllable list', licence: 'MIT', url: 'https://github.com/zh-lx/pinyin-pro' },
  { name: 'ts-fsrs', what: 'Spaced-repetition scheduling', licence: 'MIT', url: 'https://github.com/open-spaced-repetition/ts-fsrs' },
  { name: 'Make Me a Hanzi', what: 'Character readings, meanings, building blocks and origins for the Reading track (derived from Unihan and CJKlib); stroke outlines used only to find look-alike characters.', licence: 'LGPL 3.0 (data), Arphic Public License (outlines)', url: 'https://github.com/skishore/makemeahanzi' },
  { name: 'Tone Perfect (Michigan State University Libraries)', what: 'Every Mandarin syllable in all four tones by six native speakers, used for single tones in the Tone Gym and sessions. Converted to mono MP3.', licence: 'CC BY-NC 4.0', url: 'https://listings.lib.msu.edu/toneperfect/' },
  {
    name: 'Wikimedia Commons / Lingua Libre',
    what: 'Real speakers saying HSK words, played before the Azure voice. Trimmed and loudness-levelled. Every file with its speaker, licence and source is listed in the credits file (link below).',
    licence: 'CC BY-SA 4.0 and other CC BY / CC BY-SA / CC0 licences, per file',
    url: 'https://lingualibre.org',
  },
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
      <RealSpeakers />
    </div>
  );
}

/** The people whose recordings of words the app plays (IDEAS #20), most recordings first. */
function RealSpeakers() {
  const vocab = useVocab();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of vocab ?? []) if (w.real) m.set(w.real, (m.get(w.real) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [vocab]);
  if (!counts.length) return null;
  const total = counts.reduce((a, [, n]) => a + n, 0);
  return (
    <>
      <h2 className="mb-2 mt-8 px-1 text-sm font-medium text-muted">Real speakers</h2>
      <div className="group-list px-4 py-3.5 text-sm">
        <p>
          {total.toLocaleString('en')} words are said by people who recorded them for Wikimedia Commons: thank you,{' '}
          {counts.map(([who, n], i) => (
            <span key={who}>
              {i > 0 && (i === counts.length - 1 ? ' and ' : ', ')}
              {who} ({n})
            </span>
          ))}
          .
        </p>
        <a href={`${import.meta.env.BASE_URL}audio/real/CREDITS.txt`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-jade underline-offset-2 hover:underline">
          Every file, speaker, licence and source
        </a>
      </div>
    </>
  );
}
