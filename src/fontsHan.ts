/**
 * Noto Sans SC for hanzi, served by the app itself (Fontsource, OFL). Its stylesheet is
 * ~150 KB (one @font-face per block of characters), so it's loaded just after start-up
 * (src/main.tsx) instead of blocking the first paint; hanzi use the system font until then.
 * The font files themselves are cached as they're used (vite.config.ts, "fonts-han").
 */
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
// Noto Serif SC (700) for the seal stamps, loaded the same lazy way.
import '@fontsource/noto-serif-sc/700.css';
