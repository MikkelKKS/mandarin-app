import './features/music/callback';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startSync } from './sync';
import { runLegacyMigration } from './lib/review';
import { loadSpeakPause, migrateSettings } from './lib/settings';
import { startPackRegistry } from './features/packs/store';
import { startMyWordsRegistry } from './features/dictionary/mywords';
import './index.css';

registerSW({ immediate: true });
startPackRegistry();
startMyWordsRegistry();
void loadSpeakPause();
void migrateSettings();
void runLegacyMigration();
void startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
