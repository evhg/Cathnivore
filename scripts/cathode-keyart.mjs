// C14 (docs/design/cathode-combat.md S9.6): renders each district's establishing frame once, from the game itself
// (`?play&shot&district=<id>`, stage `keyart`: her start, a little above her eye, no gun, no HUD), and writes it to
// games/cathode/public/keyart/<id>.webp for the loading screen. The duotone, halftone, grain and Ken Burns push are
// applied in CSS over it (styles.css `.ld-art`), so the files stay small and the look stays editable.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-keyart.mjs [district ...]
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = 'games/cathode/public/keyart'
mkdirSync(out, { recursive: true })
const districts = process.argv.slice(2).length ? process.argv.slice(2) : ['market', 'clinic', 'plaza', 'tower', 'vault']
const W = 1920
const H = 1080

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
for (const d of districts) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const page = await ctx.newPage()
  const q = d === 'market' ? '' : `&district=${d}`
  await page.goto(`${base}?play&shot&quality=${process.env.Q ?? 'high'}${q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 600_000 })
  // The case file covers the street until its figure has eased to 100% (dozens of frames under SwiftShader): the
  // street is built by now, so take the case file off.
  await page.evaluate(() => {
    document.getElementById('loading')?.setAttribute('hidden', '')
    document.getElementById('front-fallback')?.classList.add('is-off')
  })
  await page.waitForTimeout(3000)
  const f0 = await page.evaluate(() => {
    window.cathode.stage('keyart')
    return window.cathode.stats.frames
  })
  await page.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 300_000 })
  const png = await page.screenshot({ timeout: 300_000 })
  // Re-encode as WebP in a blank page (no CSP there).
  const enc = await browser.newPage()
  const b64 = await enc.evaluate(
    async ([src, w, h]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${src}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      return c.toDataURL('image/webp', 0.72).split(',')[1]
    },
    [png.toString('base64'), W, H],
  )
  await enc.close()
  const buf = Buffer.from(b64, 'base64')
  writeFileSync(`${out}/${d}.webp`, buf)
  console.log(d, `${(buf.length / 1024).toFixed(0)} KB`)
  await ctx.close()
}
await browser.close()
