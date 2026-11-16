import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const out = process.env.OUT; mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844], D: [1440, 900], D2: [1280, 800], D3: [1920, 1080] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const sizes = (process.env.SIZES ?? 'P,D').split(',')
for (const level of [21, 34]) for (const size of sizes) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size === 'P', isMobile: size === 'P' })
  const page = await ctx.newPage()
  const url = `http://localhost:4180/hedgerow/?sandbox=1&2d`
  await page.goto(url)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${url}&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const g = window.hedgerow.game()
    return { canvas: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], cols: g.level.cols, rows: g.level.rows }
  })
  console.log(level, size, JSON.stringify(m))
  await page.screenshot({ path: `${out}/l${level}-${size}.png` })
  await ctx.close()
}
await browser.close()
