// Plan item 163: the build rack's tower portraits, and the same towers on the field (2D), at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/rack163 TAG=after node scripts/hedgerow-rack-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/rack163'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } }
for (const [s, opts] of Object.entries(SIZES)) {
  const p = await b.newPage(opts)
  const lv = 21
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate((l) => {
    const stars = {}
    for (let i = 1; i < l; i++) stars[i] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } }))
  }, lv)
  await p.goto(`${base}/hedgerow/?2d&sandbox=1&level=${lv}`)
  await p.waitForTimeout(2500)
  if (s === 'D') await p.locator('.tray').first().screenshot({ path: `${out}/${tag}-rack-D.png` })
  await p.evaluate(() => {
    const hg = window.hedgerow
    const g = hg.game()
    const kinds = ['windmill', 'mast', 'silo', 'beehive', 'scarecrow', 'cannon']
    let k = 0
    for (let r = 2; r < g.level.rows && k < kinds.length; r += 2)
      for (let c = 1; c < g.level.cols && k < kinds.length; c += 2) if (hg.place(g, kinds[k], c, r).ok) k++
    hg.refresh()
  })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${tag}-field-${s}.png` })
  await p.close()
}
await b.close()
