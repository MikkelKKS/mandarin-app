import './features/music/callback';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startSync } from './sync';
import { runLegacyMigration } from './lib/review';
import { startAudioReports } from './lib/audioReports';
import { loadSpeakPause, migrateSettings } from './lib/settings';
import { migrateMyWords } from './features/dictionary/mywords';
// Fonts are served by the app itself (Fontsource, OFL), not a font service, so they work offline from the first visit.
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
// The same family at its condensed width, for numbers that are the point (.num).
import '@fontsource-variable/instrument-sans/wdth.css';
import './index.css';

void import('./fontsHan');

registerSW({ immediate: true });
void loadSpeakPause();
void migrateSettings();
void runLegacyMigration();
void migrateMyWords();
startAudioReports();
void startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
