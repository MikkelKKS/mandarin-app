/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { citationTones } from './scripts/vite-citation-tones';
import { vocabModules } from './scripts/vite-vocab';

// Served from https://<user>.github.io/mandarin-app/
const base = process.env.BASE_PATH ?? '/mandarin-app/';

export default defineConfig({
  base,
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    citationTones(import.meta.dirname),
    vocabModules(import.meta.dirname),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mandarin — learn to listen',
        short_name: 'Mandarin',
        description: 'Personal Mandarin listening and conversation practice',
        theme_color: '#14532d',
        background_color: '#c0362d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + bundled content JSON are precached; audio is cached as it's
        // used and prefetched for unlocked units (see src/lib/audio.ts).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 5000 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/dict/cedict.tsv') || url.pathname.endsWith('/dict/t2s.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'dictionary', cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 300 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
