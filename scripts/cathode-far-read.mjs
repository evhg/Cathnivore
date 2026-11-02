// Plan item 41: does a guard read at 25 m at night? Boots each district (`?play&shot`), stages the nearest street
// guard 25 m ahead facing her and turned away (`enemy-front-25m`, `enemy-back-25m`), and measures his mean luminance
// against the street round him with `probeEnemy` (his own pixels masked out). The plan's bar: 15% or more apart.
// Saves each frame to OUT.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-far-read.mjs [district ...]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots/far-read'
const dist = Number(process.env.DIST ?? 25)
mkdirSync(out, { recursive: true })
const districts = process.argv.slice(2).length ? process.argv.slice(2) : ['plaza']
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
let worst = 1
for (const d of districts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const page = await ctx.newPage()
  await page.goto(`${base}?play&shot${d === 'market' ? '' : `&district=${d}`}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 600_000 })
  await page.evaluate(() => {
    document.getElementById('loading')?.setAttribute('hidden', '')
    document.getElementById('front-fallback')?.classList.add('is-off')
  })
  await page.waitForTimeout(3000)
  for (const face of ['front', 'back']) {
    const r = await page.evaluate((name) => window.cathode.stage(name, 60), `enemy-${face}-${dist}m`)
    await page.waitForTimeout(1500)
    const pe = await page.evaluate(() => window.cathode.probeEnemy?.() ?? null)
    await page.screenshot({ path: `${out}/${d}-${face}-${dist}m.png`, timeout: 300_000 })
    if (!pe) {
      console.log(d, face, r, 'no probe')
      continue
    }
    const gap = Math.abs(pe.enemy - pe.street)
    worst = Math.min(worst, gap)
    console.log(`${d} ${face} ${dist} m: enemy ${pe.enemy.toFixed(3)} street ${pe.street.toFixed(3)} gap ${(gap * 100).toFixed(1)}% height ${pe.heightPx.toFixed(0)} px ${gap >= 0.15 ? 'ok' : 'UNDER 15%'}`)
  }
  await ctx.close()
}
await browser.close()
console.log(`worst gap ${(worst * 100).toFixed(1)}%`)
