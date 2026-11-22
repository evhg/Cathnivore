// Plan item 653: the first-week climb's three boards (`?climb`), and the lesson's handover into it, at P and D.
// Needs a dist-site preview on :4180 (BASE overrides).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.argv[2] ?? 'e2e/screenshots/r653'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['D', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.goto(`${base}/runnel/`)
  for (let i = 0; i < 3; i++) { await p.locator('.tiles > g.cell.lesson-target').click({ force: true }); await p.waitForTimeout(300) }
  await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/climb1-${s}.png` })
  for (const n of [2, 3]) {
    await p.evaluate((n) => { const d = JSON.parse(localStorage.getItem('runnel:v1')); d.climb = n - 1; delete d.climbGame; localStorage.setItem('runnel:v1', JSON.stringify(d)) }, n)
    await p.reload(); await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/climb${n}-${s}.png` })
  }
  await ctx.close()
}
await browser.close()
