// Plan item 549: the desktop rail (shelf, featured goal, resource tiles) at D, plus P. Usage: npm run build && npx vite preview --port 4190 & OUT=dir node scripts/cathnivore-549-shots.mjs
import { chromium } from '@playwright/test'
const out = process.env.OUT, base = 'http://localhost:4190'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, opt] of Object.entries({ D: { viewport: { width: 1440, height: 900 } }, P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } })) {
  const ctx = await browser.newContext(opt); const p = await ctx.newPage()
  await p.goto(`${base}/?e2eHandFan=1`); await p.waitForTimeout(1500)
  await p.getByText('Quick Game').click(); await p.waitForTimeout(800)
  await p.getByRole('button', { name: 'Start' }).click()
  if (s === 'D') await p.mouse.move(2, 2)
  await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/game-${s}.png` })
  if (s === 'D') {
    const pin = p.locator('.shelf-pin').nth(1); if (await pin.count()) { await pin.click(); await p.mouse.move(2,2); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/game-${s}-pinned.png` }) }
  }
  await ctx.close()
}
await browser.close()
