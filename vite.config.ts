import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { criticalCss } from './scripts/critical-css.ts'

// `npm run build` (the iPhone app, e2e and gates) builds the game at `/` into `dist/`. The website build
// (`scripts/build-site.ts`) builds it again under `/cathnivore/` into `dist-site/cathnivore/`, because the site
// root is the games landing page.
const base = process.env.CATHNIVORE_BASE ?? '/'
const outDir = process.env.CATHNIVORE_OUT_DIR ?? 'dist'

function versionFile(): Plugin {
  return {
    name: 'cathnivore-version-file',
    closeBundle() {
      let commit = 'unknown'
      try {
        commit = execSync('git rev-parse HEAD').toString().trim()
      } catch {
        // no git info available; keep 'unknown'
      }
      const payload = {
        commit,
        buildTime: new Date().toISOString(),
      }
      writeFileSync(resolve(import.meta.dirname, outDir, 'version.json'), JSON.stringify(payload, null, 2))
    },
  }
}

// No font preloads (gate 7, 2026-11-11): every face is font-display: swap over a metric-matched fallback, so the
// first paint never waits for a font, and preloading the two first-screen faces (100 kB) only took bandwidth from
// the CSS and JS the first paint does wait for. Lighthouse mobile measured 82-83 with them and 87-89 without.

// The static /privacy and /support pages (public/pages.css) can't import hashed assets, so the two faces
// they use are emitted at a stable path, /type/<file>.woff2. scripts/build-site.ts copies them to the root.
const PAGE_FONTS = [
  'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2',
  'node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
]

function pageFonts(): Plugin {
  return {
    name: 'cathnivore-page-fonts',
    apply: 'build',
    generateBundle() {
      for (const file of PAGE_FONTS) {
        this.emitFile({ type: 'asset', fileName: `type/${file.split('/').pop()}`, source: readFileSync(resolve(import.meta.dirname, file)) })
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    versionFile(),
    pageFonts(),
    criticalCss(),
    // SPEC 11.1: offline play and home-screen install on the web. The SW is never bundled into the
    // iPhone app (Capacitor never serves this dist output through vite-plugin-pwa's registration
    // script — main.tsx only calls registerSW() when Capacitor.isNativePlatform() is false).
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Cathnivore',
        short_name: 'Cathnivore',
        description: 'A cooperative engine-building strategy game.',
        theme_color: '#F4EDE1',
        background_color: '#F4EDE1',
        display: 'standalone',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg,json,png}'],
      },
    }),
  ],
  build: {
    outDir,
  },
})
