import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startSync } from './sync';
import { loadSpeakPause } from './lib/settings';
import { startPackRegistry } from './features/packs/store';
import './index.css';

registerSW({ immediate: true });
startPackRegistry();
void loadSpeakPause();
void startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
