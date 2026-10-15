// U13: Hedgerow Cath sheet and Seed Bank at P/L/D. Needs a dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['L', 844, 390], ['D', 1440, 900]]) {
  for (const [id, dlg] of [['btn-cath', 'dlg-cath'], ['btn-bank', 'dlg-bank']]) {
    const scheme = process.env.SCHEME ?? 'light'
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme })
    await page.goto(`${base}?sandbox=1&2d`)
    await page.waitForSelector(`#${id}`, { timeout: 30000 })
    await page.locator(`#${id}`).click()
    await page.waitForSelector(`#${dlg}[open]`)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `e2e/screenshots/hedgerow-${dlg}-${name}${scheme === 'dark' ? '-dark' : ''}.png` })
    await page.close()
  }
}
await browser.close()
