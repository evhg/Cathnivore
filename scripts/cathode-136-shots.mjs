// Plan item 136: the class pick's audition, shot mid-vignette for every class at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  node scripts/cathode-136-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/a136'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
for (const [s, o] of Object.entries(SIZES)) {
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear()
      sessionStorage.setItem('seeded', '1')
    }
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await p.goto(`${base}/nightshift/?play&rs=0.5`)
  await p.waitForFunction(() => window.cathodeFront?.scene()?.dressed === 'ghost', null, { timeout: 200000 })
  for (const cls of ['butcher', 'gunslinger', 'wirewitch', 'fixer', 'ghost']) {
    await p.locator(`.cp-opt[data-cls=${cls}]`).click()
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/after-${cls}-${s}.png` })
  }
  await ctx.close()
}
await browser.close()
