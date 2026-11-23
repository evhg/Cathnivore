// Plan item 681: Cath's level-up badge mid-flight and landed, at P and D (2D, level 3 sandbox). OUT=dir node scripts/hedgerow-681-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/h681'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/hedgerow/?sandbox=1&2d')
  await p.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 3 }, seenBefore: { 3: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })))
  await p.goto('http://localhost:4175/hedgerow/?sandbox=1&2d&level=3')
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 }); await p.waitForTimeout(1200)
  await p.evaluate(() => window.hedgerow.heroUp())
  await p.waitForTimeout(260); await p.screenshot({ path: `${out}/${tag}-${s}-rise.png` })
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${tag}-${s}-fly.png` })
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${tag}-${s}-landed.png` })
  await ctx.close()
}
await b.close()
