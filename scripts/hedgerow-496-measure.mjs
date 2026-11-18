// Plan item 496: where the act map's trail sits in the desktop viewport. Seeds the save as hedgerow-map.spec does
// (levels 1..upTo won), loads the map in 2D and reports the centroid of the stops' number badges that are in view,
// as a share of the viewport (0.33-0.67 is the middle third), with a shot per case.
// Usage: a dist-site preview, then BASE=http://localhost:4186 OUT=<dir> node scripts/hedgerow-496-measure.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4175'
const out = process.env.OUT ?? 'e2e/screenshots/h496'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  for (const upTo of [3, 6, 21]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${base}/hedgerow/?2d`)
    await page.evaluate((n) => {
      const stars = {}, seenBefore = {}
      for (let i = 1; i <= n; i++) { stars[String(i)] = 3; seenBefore[String(i)] = true }
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
    }, upTo)
    await page.reload()
    await page.locator('button.node.next').waitFor()
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const pts = [...document.querySelectorAll('.stop .level-num')].map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth)
        .map((b) => [b.left + b.width / 2, b.top + b.height / 2])
      if (!pts.length) return null
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
      const ys = pts.map((p) => p[1] / innerHeight)
      return { stops: pts.length, cx: +(cx / innerWidth).toFixed(3), cy: +(cy / innerHeight).toFixed(3), yMin: +Math.min(...ys).toFixed(2), yMax: +Math.max(...ys).toFixed(2) }
    })
    console.log(`${w}x${h} upTo ${upTo}`, JSON.stringify(r))
    await page.screenshot({ path: `${out}/map-${w}-${upTo}.png` })
    await page.close()
  }
}
await browser.close()
