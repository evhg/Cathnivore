// Plan item 621: the 2D field at levels 21 and 34 with towers built and a round in flight, at P and D; logs each
// tower's drawn height in CSS px (cell size x the field scale x the tier scale is approximated by the cell size).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &
//        OUT=<dir> node scripts/hedgerow-621-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4190/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/h621'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const level of [21, 34]) for (const size of Object.keys(SIZES)) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: size !== 'D', isMobile: size !== 'D' })
  const page = await ctx.newPage()
  const url = `${base}?sandbox=1&2d`
  await page.goto(url)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${url}&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/l${level}-empty-${size}.png` })
  const n = await page.evaluate(() => {
    const hg = window.hedgerow
    const g = hg.game()
    const kinds = ['scarecrow', 'beehive', 'silo', 'windmill', 'cannon', 'mast']
    const plots = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) plots.push([c, r])
    plots.sort((a, b) => Math.hypot(a[0] - g.level.cols / 2, a[1] - g.level.rows / 2) - Math.hypot(b[0] - g.level.cols / 2, b[1] - g.level.rows / 2))
    let k = 0
    const placed = []
    for (const [c, r] of plots) {
      if (k >= kinds.length) break
      if (placed.some(([x, y]) => Math.max(Math.abs(x - c), Math.abs(y - r)) < 2)) continue
      for (const kind of [kinds[k], 'scarecrow']) if (hg.place(g, kind, c, r).ok) { placed.push([c, r]); k++; break }
    }
    hg.sendWave?.(g)
    return placed.length
  })
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(900)
    const got = page.getByRole('button', { name: 'Got it' })
    if (await got.isVisible().catch(() => false)) await got.click()
  }
  await page.screenshot({ path: `${out}/l${level}-play-${size}.png` })
  const cell = await page.evaluate(() => {
    const g = window.hedgerow.game()
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]
    return { cols: g.level.cols, rows: g.level.rows, cw: cv?.clientWidth, ch: cv?.clientHeight }
  })
  console.log(level, size, 'towers', n, JSON.stringify(cell))
  await ctx.close()
}
await browser.close()
