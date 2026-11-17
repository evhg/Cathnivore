// Plan item 480: the farmhouse doorstep at 0, 3 and 8+ parcels, and the sale board, in 3D and 2D at D and P (2x).
// OUT=<dir> LEVEL=3 node scripts/hedgerow-480-shots.mjs (a dist-site preview on :4190)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4190'
const out = process.env.OUT
const level = Number(process.env.LEVEL ?? 3)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h, mob] of [['D', 1440, 900, false], ['P', 390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob })
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  const stars = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), 3]))
  const seen = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), true]))
  await p.evaluate(([s, t, v]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: v, tips: t })), [stars, tips, seen])
  for (const mode of ['3d', '2d']) {
    await p.goto(`${base}/hedgerow/?sandbox=1&level=${level}${mode === '2d' ? '&2d' : ''}`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 120000 })
    await p.waitForFunction(() => window.hedgerow.camSettled(), null, { timeout: 120000 })
    await p.waitForTimeout(3000)
    let shown = 0
    for (const n of [0, 3, 9]) {
      if (n > shown) await p.evaluate((k) => window.hedgerow.leakDoorstep(k), n - shown)
      shown = n
      await p.waitForTimeout(mode === '3d' ? 5000 : 1500)
      await p.screenshot({ path: `${out}/l${level}-${mode}-${n}-${name}.png` })
    }
    await p.evaluate(() => { const g = window.hedgerow.game(); g.goodwill = Math.floor(g.maxGoodwill * 0.2) })
    await p.waitForTimeout(mode === '3d' ? 5000 : 1500)
    await p.screenshot({ path: `${out}/l${level}-${mode}-sale-${name}.png` })
  }
  await ctx.close()
}
await browser.close()
