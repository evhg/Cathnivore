// Builds the whole cathnivore.com website into dist-site/ (Vercel's output directory):
//
//   /             the games landing page (site/)
//   /cathnivore/  Cathnivore, the same app `npm run build` makes, rebuilt under a base path
//   /runnel/      Runnel, the daily irrigation puzzle (games/runnel/)
//   /hedgerow/    Hedgerow, Cath's tower defence (games/hedgerow/)
//   /cathode/     CATHODE, the noir shooter (games/cathode/), behind an 18+ gate
//   /privacy, /support, /type, /licences/fonts, icons, version.json   shared files at the root
//
// `npm run build` is unchanged and still builds Cathnivore alone into dist/ for the iPhone app, e2e and
// gates. Usage: `npm run build:site`.

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'vite'
import { siteServiceWorkerSource } from './siteServiceWorker'

const root = resolve(import.meta.dirname, '..')
// SITE_OUT builds into another folder (a second preview beside a running one, for before/after shots).
const out = resolve(root, process.env.SITE_OUT ?? 'dist-site')

function commit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: root }).toString().trim()
  } catch {
    return 'unknown'
  }
}

// `--only=landing,runnel` rebuilds just those parts into an existing dist-site/ (a quick local loop for
// UI work); the full build (no flag) is what Vercel runs.
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const want = (name: string): boolean => !only || only.includes(name)

// AAA UI: every face the site ships, with its OFL text at /licences/fonts/ (VISION.md "Illustration").
const FONT_FAMILIES: Array<[string, string, string]> = [
  ['Fraunces', '@fontsource-variable/fraunces', 'Landing, Cathnivore, Runnel, Hedgerow'],
  ['Instrument Sans', '@fontsource-variable/instrument-sans', 'Landing'],
  ['Instrument Serif', '@fontsource/instrument-serif', 'Landing'],
  ['Atkinson Hyperlegible Next', '@fontsource-variable/atkinson-hyperlegible-next', 'Cathnivore, Runnel'],
  ['Figtree', '@fontsource-variable/figtree', 'Cathnivore'],
  ['Outfit', '@fontsource-variable/outfit', 'Runnel'],
  ['Nunito', '@fontsource-variable/nunito', 'Hedgerow'],
  ['Bodoni Moda', '@fontsource-variable/bodoni-moda', 'CATHODE'],
  ['Archivo', '@fontsource-variable/archivo', 'CATHODE'],
]

function writeFontLicences(): void {
  const dir = resolve(out, 'licences/fonts')
  mkdirSync(dir, { recursive: true })
  const rows: string[] = []
  for (const [family, pkg, where] of FONT_FAMILIES) {
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    writeFileSync(resolve(dir, `${slug}.txt`), readFileSync(resolve(root, 'node_modules', pkg, 'LICENSE'), 'utf8'))
    rows.push(`        <li><a href="/licences/fonts/${slug}.txt">${family}</a> <span>${where}</span></li>`)
  }
  writeFileSync(
    resolve(dir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Font licences: cathnivore.com</title>
    <link rel="stylesheet" href="/pages.css" />
  </head>
  <body>
    <main>
      <h1>Font licences</h1>
      <p>Every typeface on cathnivore.com is self-hosted and free under the SIL Open Font License 1.1. Thank you to their designers.</p>
      <ul>
${rows.join('\n')}
      </ul>
      <p><a href="/">Back to the games</a></p>
    </main>
  </body>
</html>
`,
  )
}

async function main(): Promise<void> {
  if (!only) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  if (want('landing')) {
    console.log('\n=== Landing page ===')
    await build({
      configFile: false,
      root: resolve(root, 'site'),
      base: '/',
      publicDir: resolve(root, 'site/public'),
      logLevel: 'warn',
      build: { outDir: out, emptyOutDir: false, assetsDir: 'site-assets' },
    })
  }
  if (want('runnel')) {
    console.log('\n=== Runnel ===')
    await build({
      configFile: false,
      root: resolve(root, 'games/runnel'),
      base: '/runnel/',
      publicDir: resolve(root, 'games/runnel/public'),
      logLevel: 'warn',
      build: { outDir: resolve(out, 'runnel'), emptyOutDir: true },
    })
  }
  if (want('hedgerow')) {
    console.log('\n=== Hedgerow ===')
    await build({
      configFile: false,
      root: resolve(root, 'games/hedgerow'),
      base: '/hedgerow/',
      publicDir: resolve(root, 'games/hedgerow/public'),
      logLevel: 'warn',
      build: { outDir: resolve(out, 'hedgerow'), emptyOutDir: true },
    })
  }
  if (want('cathode')) {
    console.log('\n=== CATHODE ===')
    await build({
      configFile: false,
      root: resolve(root, 'games/cathode'),
      base: '/cathode/',
      publicDir: resolve(root, 'games/cathode/public'),
      logLevel: 'warn',
      build: { outDir: resolve(out, 'cathode'), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
    })
  }
  if (want('cathnivore')) {
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
  }

  // Shared root files: Cathnivore's store listing links to /privacy and /support, and its manifest and
  // social card use root icon paths. /type holds the two faces the static pages use (see vite.config.ts).
  const pageType = resolve(out, 'cathnivore/type')
  if (existsSync(pageType)) cpSync(pageType, resolve(out, 'type'), { recursive: true })
  writeFontLicences()
  for (const name of ['privacy', 'support', 'pages.css', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'social-preview.png']) {
    const from = resolve(root, 'public', name)
    if (existsSync(from) && !existsSync(resolve(out, name))) cpSync(from, resolve(out, name), { recursive: true })
  }

  writeFileSync(resolve(out, 'sw.js'), siteServiceWorkerSource())

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
