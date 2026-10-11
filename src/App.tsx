import { useEffect, type ReactNode } from 'react';
import { WordPopupProvider } from './components/Hanzi';
import { Cog, Gamepad, Path, Refresh } from './components/icons';
import { GameRunner, GamesView } from './features/games/GamesView';
import { NodeRunner, PracticeRunner, TestOutRunner } from './features/lesson/Runners';
import { PathView, useNodeStates } from './features/path/PathView';
import { About } from './features/settings/About';
import { SettingsView } from './features/settings/SettingsView';
import { prefetchForOffline } from './lib/audio';
import { unlockedItemIds } from './lib/progress';
import { go, useRoute } from './lib/router';
import { applyTheme, loadSettings } from './lib/settings';

export default function App() {
  const route = useRoute();
  useEffect(() => {
    loadSettings().then((s) => applyTheme(s.theme));
  }, []);
  const [page, arg] = route;

  let body: ReactNode;
  switch (page) {
    case 'lesson':
      return (
        <WordPopupProvider>
          <NodeRunner key={arg} nodeId={arg} />
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
    case 'game':
      return (
        <WordPopupProvider>
          <GameRunner key={arg} id={arg} />
        </WordPopupProvider>
      );
    case 'games':
      body = <GamesView />;
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
      <Shell active={page ?? ''}>{body}</Shell>
      <OfflinePrefetch />
    </WordPopupProvider>
  );
}

const TABS = [
  { id: '', label: 'Learn', icon: Path },
  { id: 'practice', label: 'Practice', icon: Refresh },
  { id: 'games', label: 'Games', icon: Gamepad },
  { id: 'settings', label: 'Settings', icon: Cog },
];

function Shell({ active, children }: { active: string; children: ReactNode }) {
  const current = active === 'about' ? 'settings' : active;
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-4"
      >
        <a href="#/" className="mb-6 hidden items-center gap-2 px-3 md:flex">
          <span className="han flex h-10 w-10 items-center justify-center rounded-xl bg-cinnabar text-xl font-bold text-white">学</span>
          <span className="text-lg font-bold">Mandarin</span>
        </a>
        {TABS.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-3 md:text-base ${on ? 'text-jade md:bg-jade-soft' : 'text-muted hover:text-ink'}`}
            >
              <t.icon className="h-6 w-6" />
              {t.label}
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
