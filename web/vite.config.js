import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Skip the PWA plugin when bundling for Tauri. Tauri's WebView doesn't run
// service workers cleanly (different security model) and the bundled
// manifest.webmanifest is unused weight inside the .dmg / .exe. Detected
// via the TAURI_PLATFORM env var which our tauri.conf.json sets in the
// beforeBuildCommand. Dev mode (`tauri dev` → vite dev server on 5173)
// already disables the SW via devOptions.enabled = false below, so this
// switch only matters for production Tauri builds.
const isTauriBuild = !!process.env.TAURI_PLATFORM

// https://vite.dev/config/
export default defineConfig({
  // Dev server: proxy API + static asset paths to the Node backend so you
  // can run `npm run dev` and hit localhost:5173 with full HMR + zero
  // service-worker caching. Production build still serves through Express.
  server: {
    port: 5173,
    proxy: {
      '/api':       { target: 'http://localhost:8080', changeOrigin: true },
      '/tts-cache': { target: 'http://localhost:8080', changeOrigin: true },
      '/music':     { target: 'http://localhost:8080', changeOrigin: true },
      '/stream':    { target: 'ws://localhost:8080',   ws: true, changeOrigin: true }
    }
  },
  plugins: [
    vue(),
    // Skip VitePWA entirely when bundling for Tauri.
    !isTauriBuild && VitePWA({
      registerType: 'autoUpdate',
      // PWA / service worker is OFF in dev mode (default). Leave this
      // explicit so nobody accidentally enables it during development —
      // SW caching is what's been making refreshes painful.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-icons/apple-touch-icon.png'],
      manifest: {
        name: 'Kimi Radio',
        short_name: 'Kimi',
        description: 'AI-powered music radio with a DJ that talks back',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0809',
        theme_color: '#B0666D',
        icons: [
          { src: 'pwa-icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Take over immediately on new deploy so users don't need a double-refresh
        // to see updated bundles. Fine for a single-user local PWA.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/stream/, /^\/tts-cache\//, /^\/music\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/tts-cache/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tts-audio',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true
            }
          }
        ]
      }
    })
  ].filter(Boolean)
})
