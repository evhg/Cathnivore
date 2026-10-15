// U13: Hedgerow Almanac at P/L/D. Needs a dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['L', 844, 390], ['D', 1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(`${base}?sandbox=1&2d`)
  await page.waitForSelector('#btn-almanac', { timeout: 30000 })
  await page.locator('#btn-almanac').click()
  await page.waitForSelector('#dlg-almanac[open]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `e2e/screenshots/hedgerow-almanac-${name}.png` })
  await page.close()
}
await browser.close()
