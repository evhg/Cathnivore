// U13: Hedgerow replay bar at P/D, both themes. Dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of ['light', 'dark'])
  for (const [name, w, h] of [['P', 390, 844], ['D', 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto(`${base}?sandbox=1&2d&level=1`)
    await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
    await page.waitForTimeout(600)
    await page.evaluate(() => { const b = document.getElementById('replay-bar'); b.hidden = false; document.getElementById('replay-fill').parentElement.style.setProperty('--p', '0.4'); document.getElementById('replay-fill').style.setProperty('--p', '0.4') })
    await page.screenshot({ path: `e2e/screenshots/hedgerow-replaybar-${scheme}-${name}.png`, clip: { x: 0, y: 0, width: w, height: 160 } })
    await ctx.close()
  }
await browser.close()
