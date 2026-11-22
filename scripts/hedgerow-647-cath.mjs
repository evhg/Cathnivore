// Plan item 647: field Cath in 3D at P and D (level 34 between rounds), full frame and a 3x crop of her figure box.
// OUT=dir node scripts/hedgerow-647-cath.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/h647'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/hedgerow/?sandbox=1')
  await p.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i + 1), 3])), seenBefore: { 34: true }, seen: {}, tips: { all: true } })))
  await p.goto(`http://localhost:4175/hedgerow/?sandbox=1&level=${process.env.LEVEL ?? 34}`)
  await p.waitForFunction(() => !!window.hedgerow?.game() && !!window.hedgerow.figureBox?.(), null, { timeout: 90000 })
  await p.waitForTimeout(8000)
  const f = await p.evaluate(() => window.hedgerow.figureBox())
  console.log(s, JSON.stringify(f))
  await p.screenshot({ path: `${out}/${tag}-cath-${s}.png` })
  const pad = 20, x = Math.max(0, f.x - pad), y = Math.max(0, f.y - pad)
  await p.screenshot({ path: `${out}/${tag}-cathcrop-${s}.png`, clip: { x, y, width: f.w + 2 * pad, height: f.h + 2 * pad }, scale: 'device' })
  await ctx.close()
}
await b.close()
