import { useEffect, type ReactNode } from 'react';
import { WordPopupProvider } from './components/Hanzi';
import { Book, Chart, Cog, Gamepad, Path, Refresh, OpenBook } from './components/icons';
import { ProgressView } from './features/progress/ProgressView';
import { WordsView } from './features/progress/WordsView';
import { MusicRoute } from './features/music/MusicView';
import { ReadRoute } from './features/read/ReadView';
import { DictionaryView } from './features/dictionary/DictionaryView';
import { GameRunner, GamesView } from './features/games/GamesView';
import { NodeRunner, PackRunner, PracticeRunner, TestOutRunner } from './features/lesson/Runners';
import { PathView, useNodeStates } from './features/path/PathView';
import { About } from './features/settings/About';
import { SettingsView } from './features/settings/SettingsView';
import { prefetchForOffline, stop } from './lib/audio';
import { unlockedItemIds } from './lib/progress';
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
    case 'testout':
      return (
        <WordPopupProvider>
          <TestOutRunner key={arg} unitId={arg} />
        </WordPopupProvider>
      );
    case 'practice':
      return (
        <WordPopupProvider>
          <PracticeRunner />
        </WordPopupProvider>
      );
    case 'pack':
      return (
        <WordPopupProvider>
          <PackRunner key={route.join('/')} id={arg} story={route[2] === 'story'} roleplay={route[2] === 'roleplay'} />
        </WordPopupProvider>
      );
    case 'game':
      return (
        <WordPopupProvider>
          <GameRunner key={arg} id={arg} />
        </WordPopupProvider>
      );
    case 'games':
      body = <GamesView />;
      break;
    case 'read':
      body = <ReadRoute route={route} />;
      break;
    case 'music':
      body = <MusicRoute route={route} />;
      break;
    case 'progress':
      body = route[1] === 'words' ? <WordsView /> : <ProgressView />;
      break;
    case 'dictionary':
      body = <DictionaryView />;
      break;
    case 'settings':
      body = <SettingsView />;
      break;
    case 'about':
      body = <About />;
      break;
    default:
      body = <PathView />;
  }
  return (
    <WordPopupProvider>
      <Shell active={page ?? ''}>
        <div key={page ?? ''} className="anim-page">
          {body}
        </div>
      </Shell>
      <OfflinePrefetch />
    </WordPopupProvider>
  );
}

const TABS = [
  { id: '', label: 'Learn', icon: Path },
  { id: 'read', label: 'Read', icon: OpenBook },
  { id: 'practice', label: 'Practice', icon: Refresh },
  { id: 'games', label: 'Games', icon: Gamepad },
  { id: 'progress', label: 'Progress', icon: Chart },
  { id: 'dictionary', label: 'Dictionary', icon: Book },
  { id: 'settings', label: 'Settings', icon: Cog },
];

function Shell({ active, children }: { active: string; children: ReactNode }) {
  const current = active === 'about' ? 'settings' : active === 'music' ? 'games' : active;
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-4"
      >
        <a href="#/" className="mb-6 hidden items-center gap-2 px-3 md:flex">
          <span className="han flex h-10 w-10 -rotate-6 items-center justify-center rounded-xl bg-cinnabar text-xl font-bold text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] transition-transform duration-300 hover:rotate-0">学</span>
          <span className="text-lg font-bold">Mandarin</span>
        </a>
        {TABS.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-medium tracking-tight sm:text-xs sm:tracking-normal transition-colors duration-200 md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-3 md:text-base ${on ? 'text-jade md:bg-jade-soft' : 'text-muted hover:text-ink md:hover:bg-sunk'}`}
            >
              <span
                className={`flex h-8 w-11 items-center justify-center rounded-full sm:w-14 transition-[background-color,transform] duration-300 [transition-timing-function:var(--ease-spring)] group-active:scale-90 md:h-auto md:w-auto md:bg-transparent ${on ? 'bg-jade-soft' : ''}`}
              >
                <t.icon className="h-6 w-6" />
              </span>
              <span className="max-w-full truncate">{t.label}</span>
            </button>
          );
        })}
      </nav>
      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-10 md:pt-10">{children}</main>
    </div>
  );
}

/** Quietly download audio for everything unlocked, for offline use. */
function OfflinePrefetch() {
  const states = useNodeStates();
  useEffect(() => {
    if (!navigator.onLine) return;
    const ids = unlockedItemIds(states);
    const t = setTimeout(() => void prefetchForOffline(ids), 4000);
    return () => clearTimeout(t);
  }, [states]);
  return null;
}
