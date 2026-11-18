// Plan item 486: the phone 3D field's legibility, measured. For levels 5, 21, 34 and 40 in 3D at 390x844 (and
// 1440x900 for reference) it saves a shot, the canvas positions of lane cells and of the plots beside the lane
// (`cellPx3d`), and how much of each depot's box is inside the canvas (`depots3d`). `scripts/hedgerow-486-measure.py`
// then reads the lane-to-plot luminance contrast (the item's 1.6:1 bar) from the shots.
// Usage: a dist-site preview on :4175, then
//   PLAYWRIGHT_CHROMIUM_PATH=... OUT=<dir> node scripts/hedgerow-486-measure.mjs && python3 scripts/hedgerow-486-measure.py <dir>
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4175'
const out = process.env.OUT ?? 'e2e/screenshots/h486'
const levels = (process.env.LEVELS ?? '5,21,34,40').split(',').map(Number)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const report = {}
for (const [size, viewport] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const level of levels) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    await page.goto(`${base}/hedgerow/?sandbox=1`)
    await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level])
    await page.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => window.hedgerow?.depotShutter3d() != null, null, { timeout: 120000 })
    // (the drifting cloud shadows off: the same build read l40's plots 0.043 then 0.029 with them)
    await page.evaluate(() => window.hedgerow.noCloudShadows3d())
    await page.waitForTimeout(10000)
    const shot = `${out}/l${level}-${size}.png`
    await page.screenshot({ path: shot })
    report[`l${level}-${size}`] = await page.evaluate(() => {
      const hg = window.hedgerow
      const L = hg.game().level
      const c = document.querySelector('#canvas').getBoundingClientRect()
      const lane = new Set(L.path.map(([x, y]) => `${x},${y}`))
      const plots = []
      for (const [x, y] of L.path) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`
        if (!lane.has(k) && x + dx >= 0 && y + dy >= 0 && x + dx < L.cols && y + dy < L.rows) plots.push([x + dx, y + dy])
      }
      const px = ([x, y]) => { const p = hg.cellPx3d(x, y); return p && [c.left + p.x, c.top + p.y] }
      const inside = (r) => {
        const w = Math.max(0, Math.min(c.width, r.x + r.w) - Math.max(0, r.x)), h = Math.max(0, Math.min(c.height, r.y + r.h) - Math.max(0, r.y))
        return r.w * r.h > 0 ? (w * h) / (r.w * r.h) : 0
      }
      return { canvas: [c.left, c.top, c.width, c.height], lane: L.path.map(px), plots: plots.map(px), depotsInside: hg.depots3d().map(inside) }
    })
    report[`l${level}-${size}`].shot = shot
    await page.close()
    console.log(`l${level}-${size}`, JSON.stringify(report[`l${level}-${size}`].depotsInside.map((v) => +v.toFixed(2))))
  }
}
writeFileSync(`${out}/measure.json`, JSON.stringify(report, null, 1))
await browser.close()
