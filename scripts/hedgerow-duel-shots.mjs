// U13: Hedgerow duel card at P/L/D. Needs a dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['L', 844, 390], ['D', 1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const url = `${base}?sandbox=1&2d`
  await page.goto(url)
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 1: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })))
  await page.goto(`${url}&level=1`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const g = window.hedgerow.game()
    g.duel = { enemy: 1, kind: 'van', round: 1, strikes: [0.9], clock: 0.4 }
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `e2e/screenshots/hedgerow-duel-${name}.png` })
  await page.close()
}
await browser.close()
