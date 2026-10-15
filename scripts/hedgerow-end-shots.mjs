// U10: Hedgerow end screen (win, loss) at P/L/D, plus reduced motion. Needs a dev server: cd games/hedgerow && npx vite --port 4181
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4181/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['L', 844, 390], ['D', 1440, 900]]) {
  for (const outcome of ['won', 'lost']) {
    for (const rm of ['no-preference', 'reduce']) {
      if (rm === 'reduce' && outcome === 'lost') continue
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: rm, colorScheme: process.env.SCHEME ?? 'light' })
      await page.goto(`${base}?sandbox=1&2d&level=3`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 30000 })
      for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
        await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
        await page.waitForTimeout(300)
      }
      await page.evaluate((o) => { window.hedgerow.game().phase = o }, outcome)
      await page.waitForSelector('#dlg-result[open]', { timeout: 15000 })
      await page.waitForTimeout(1800)
      await page.screenshot({ path: `e2e/screenshots/hedgerow-end-${process.env.SCHEME === 'dark' ? 'dark-' : ''}${outcome}-${rm === 'reduce' ? 'rm-' : ''}${name}.png` })
      await page.close()
    }
  }
}
await browser.close()
