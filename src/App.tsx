import { useEffect, type ReactNode } from 'react';
import { WordPopupProvider } from './components/Hanzi';
import { Chart, Cog, Home, Library, Waves } from './components/icons';
import { StatsView } from './features/stats/StatsView';
import { WordsView } from './features/progress/WordsView';
import { MusicRoute } from './features/music/MusicView';
import { ReadRoute } from './features/read/ReadView';
import { DictionaryView } from './features/dictionary/DictionaryView';
import { NodeRunner } from './features/lesson/Runners';
import { PathView } from './features/path/PathView';
import { LibraryView } from './features/library/LibraryView';
import { About } from './features/settings/About';
import { AudioSample } from './features/settings/AudioSample';
import { ToneGymRoute } from './features/tonegym/ToneGym';
import { HomeView } from './features/home/HomeView';
import { PlacementView } from './features/placement/PlacementView';
import { SessionRoute } from './features/session/SessionPlayer';
import { SettingsView } from './features/settings/SettingsView';
import { prefetchForOffline, stop } from './lib/audio';
import { db } from './db/db';
import { go, useRoute } from './lib/router';
import { applyTheme, loadSettings } from './lib/settings';

export default function App() {
  const route = useRoute();
  useEffect(() => {
    loadSettings().then((s) => applyTheme(s.theme));
  }, []);
  const [page, arg] = route;
  // Whatever was playing belongs to the screen you just left.
  const routeKey = route.join('/');
  useEffect(() => {
    stop();
  }, [routeKey]);

  let body: ReactNode;
  switch (page) {
    case 'lesson':
      return (
        <WordPopupProvider>
          <NodeRunner key={route.join('/')} nodeId={arg} roleplay={route[2] === 'roleplay'} />
        </WordPopupProvider>
      );
    case 'session':
      return (
        <WordPopupProvider>
          <SessionRoute key={route.join('/')} route={route} />
        </WordPopupProvider>
      );
    case 'tone-gym':
      if (route[1])
        return (
          <WordPopupProvider>
            <ToneGymRoute route={route} />
          </WordPopupProvider>
        );
      body = <ToneGymRoute route={route} />;
      break;
    case 'library':
      body = <LibraryView />;
      break;
    case 'conversations':
      body = <PathView />;
      break;
    case 'read':
      body = <ReadRoute route={route} />;
      break;
    case 'music':
      body = <MusicRoute route={route} />;
      break;
    case 'dictionary':
      body = <DictionaryView />;
      break;
    case 'words':
      body = <WordsView />;
      break;
    case 'placement':
      body = <PlacementView />;
      break;
    case 'progress':
      body = route[1] === 'words' ? <WordsView /> : <StatsView />;
      break;
    case 'settings':
      body = <SettingsView />;
      break;
    case 'about':
      body = <About />;
      break;
    case 'audio-sample':
      body = <AudioSample />;
      break;
    default:
      body = <HomeView />;
  }
  return (
    <WordPopupProvider>
      <Shell active={page ?? ''}>
        <div key={route.join('/')} className="anim-page">
          {body}
        </div>
      </Shell>
      <OfflinePrefetch />
    </WordPopupProvider>
  );
}

const TABS = [
  { id: '', label: 'Home', icon: Home },
  { id: 'tone-gym', label: 'Tones', icon: Waves },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'progress', label: 'Stats', icon: Chart },
  { id: 'settings', label: 'Settings', icon: Cog },
];

/** Which tab a page belongs to. */
const TAB_OF: Record<string, string> = {
  about: 'settings',
  'audio-sample': 'settings',
  conversations: 'library',
  read: 'library',
  music: 'library',
  dictionary: 'library',
  words: 'library',
  placement: '',
};

function Shell({ active, children }: { active: string; children: ReactNode }) {
  const current = TAB_OF[active] ?? active;
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:gap-0.5 md:border-r md:border-t-0 md:bg-transparent md:px-4 md:py-8 md:backdrop-blur-none"
      >
        <a href="#/" className="mb-8 hidden items-center gap-3 px-3 md:flex">
          <span className="han flex h-9 w-9 items-center justify-center rounded-[10px] bg-cinnabar text-lg font-semibold text-white">学</span>
          <span className="text-[1.0625rem] font-semibold">Mandarin</span>
        </a>
        {TABS.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5 text-[11px] font-medium transition-colors duration-200 md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-[0.9375rem] ${on ? 'text-jade md:bg-surface md:text-ink md:shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              <t.icon className={`h-[22px] w-[22px] transition-transform duration-200 ${on ? 'md:text-jade' : ''}`} />
              <span className="max-w-full truncate">{t.label}</span>
            </button>
          );
        })}
      </nav>
      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))] md:max-w-2xl md:px-8 md:pb-12 md:pt-12">{children}</main>
    </div>
  );
}

/** Quietly download audio for the cards coming up in the next two days, for offline use. */
function OfflinePrefetch() {
  useEffect(() => {
    if (!navigator.onLine) return;
    const t = setTimeout(async () => {
      const soon = await db.reviewItems.where('due').below(Date.now() + 2 * 864e5).toArray();
      const ids = [...new Set(soon.filter((c) => c.state !== 0).map((c) => c.word ?? c.id))];
      void prefetchForOffline(ids);
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
