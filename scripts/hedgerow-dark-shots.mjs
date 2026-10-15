// U13: Hedgerow evening (dark) theme: map, duel, pause, Cath sheet at P and D. Dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['D', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' })
  const page = await ctx.newPage()
  const url = `${base}?sandbox=1&2d`
  await page.goto(url)
  await page.waitForSelector('#btn-bank', { timeout: 30000 })
  await page.screenshot({ path: `e2e/screenshots/hedgerow-dark-map-${name}.png` })
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 1: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })))
  await page.goto(`${url}&level=1`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.evaluate(() => { window.hedgerow.game().duel = { enemy: 1, kind: 'van', round: 1, strikes: [0.9], clock: 0.4 } })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `e2e/screenshots/hedgerow-dark-duel-${name}.png` })
  await ctx.close()
}
await browser.close()
