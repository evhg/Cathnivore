// Builds the whole cathnivore.com website into dist-site/ (Vercel's output directory):
//
//   /             the games landing page (site/)
//   /cathnivore/  Cathnivore, the same app `npm run build` makes, rebuilt under a base path
//   /runnel/      Runnel, the daily irrigation puzzle (games/runnel/)
//   /privacy, /support, /fonts, icons, version.json   shared files at the root
//
// `npm run build` is unchanged and still builds Cathnivore alone into dist/ for the iPhone app, e2e and
// gates. Usage: `npm run build:site`.

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'vite'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'dist-site')

function commit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: root }).toString().trim()
  } catch {
    return 'unknown'
  }
}

async function main(): Promise<void> {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  console.log('\n=== Landing page ===')
  await build({
    configFile: false,
    root: resolve(root, 'site'),
    base: '/',
    publicDir: resolve(root, 'site/public'),
    logLevel: 'warn',
    build: { outDir: out, emptyOutDir: false, assetsDir: 'site-assets' },
  })

  console.log('\n=== Runnel ===')
  await build({
    configFile: false,
    root: resolve(root, 'games/runnel'),
    base: '/runnel/',
    publicDir: resolve(root, 'games/runnel/public'),
    logLevel: 'warn',
    build: { outDir: resolve(out, 'runnel'), emptyOutDir: true },
  })

  console.log('\n=== Cathnivore ===')
  process.env.CATHNIVORE_BASE = '/cathnivore/'
  process.env.CATHNIVORE_OUT_DIR = 'dist-site/cathnivore'
  await build({ configFile: resolve(root, 'vite.config.ts'), root, logLevel: 'warn' })
  delete process.env.CATHNIVORE_BASE
  delete process.env.CATHNIVORE_OUT_DIR

  // The game's index.html hard-codes a root manifest link next to the one vite-plugin-pwa injects under
  // the base path; drop the root one so the browser only sees the game's own manifest.
  const gameHtml = resolve(out, 'cathnivore/index.html')
  writeFileSync(
    gameHtml,
    readFileSync(gameHtml, 'utf8').replace('<link rel="manifest" href="/manifest.webmanifest" />\n', ''),
  )

  // Shared root files: Cathnivore's store listing links to /privacy and /support, its manifest and
  // social card use root icon paths, and every page loads fonts from /fonts.
  for (const name of ['fonts', 'privacy', 'support', 'pages.css', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'social-preview.png']) {
    const from = resolve(root, 'public', name)
    if (existsSync(from) && !existsSync(resolve(out, name))) cpSync(from, resolve(out, name), { recursive: true })
  }

  // Before the portfolio, Cathnivore lived at / with a service worker scoped to the whole site. Anyone
  // who played then still has it; it would keep serving the old cached game at /. This replacement
  // clears its caches, unregisters itself and reloads open tabs so they get the landing page.
  writeFileSync(
    resolve(out, 'sw.js'),
    `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
  })())
})
`,
  )

  writeFileSync(
    resolve(out, 'version.json'),
    JSON.stringify({ commit: commit(), buildTime: new Date().toISOString() }, null, 2),
  )
  console.log(`\nSite built into ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
