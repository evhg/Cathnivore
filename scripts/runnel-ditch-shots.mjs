// Plan item 61: Runnel's ditches. The daily, the lesson and a solved board (one tap from solved, then the tap,
// the win card closed) at P and D, light and dark, in autumn and winter, under a golden-hour light.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then node scripts/runnel-ditch-shots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const base = 'http://localhost:4186/runnel/'
const outDir = process.env.OUT ?? 'e2e/screenshots/ditch61'
mkdirSync(outDir, { recursive: true })
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]])
  for (const scheme of ['light', 'dark'])
    for (const season of ['autumn', 'winter']) {
      const ctx = await b.newContext({ viewport: vp, colorScheme: scheme })
      const p = await ctx.newPage()
      const shot = async (what) => {
        await p.evaluate((s) => (document.documentElement.dataset.season = s), season)
        await p.waitForTimeout(500)
        await p.screenshot({ path: `${outDir}/${what}-${n}-${scheme}-${season}.png` })
      }
      await p.goto(base + '?nohelp&sky=golden,clear')
      await p.waitForTimeout(900)
      await shot('daily')
      await p.evaluate(() => window.runnelTest?.nearlySolve())
      await p.locator('#board [data-last]').click().catch(() => {})
      await p.waitForTimeout(1500)
      await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
      await shot('solved')
      await p.goto(base + '?lesson&sky=golden,clear')
      await p.waitForTimeout(900)
      await shot('lesson')
      await ctx.close()
    }
await b.close()
