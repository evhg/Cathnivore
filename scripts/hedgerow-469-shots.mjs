// Plan item 469: a level's ?keyart frame in 3D and 2D at D and P (2x). OUT=<dir> LEVELS=21 node scripts/hedgerow-469-shots.mjs (preview on :4190)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4190'
const out = process.env.OUT
const levels = (process.env.LEVELS ?? '21').split(',').map(Number)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h, mob] of [['D', 1440, 900, false], ['P', 390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob })
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  const stars = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), 3]))
  const seen = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), true]))
  await p.evaluate(([s, t, v]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: v, tips: t })), [stars, tips, seen])
  for (const level of levels) {
    await p.goto(`${base}/hedgerow/?keyart&sandbox=1&level=${level}`)
    await p.waitForFunction(() => document.documentElement.hasAttribute('data-keyart-still'), null, { timeout: 120000 })
    await p.waitForTimeout(800)
    await p.screenshot({ path: `${out}/l${level}-3d-${name}.png` })
    await p.goto(`${base}/hedgerow/?keyart&sandbox=1&2d&level=${level}`)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/l${level}-2d-${name}.png` })
    await p.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 120000 })
    await p.waitForTimeout(6000)
    await p.screenshot({ path: `${out}/l${level}-play-${name}.png` })
  }
  await ctx.close()
}
await browser.close()
