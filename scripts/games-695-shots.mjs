// Plan item 695: the /games/ landing page at D and P (the Cathnivore card's key art crop).
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const out = process.env.OUT ?? 'e2e/screenshots/g695'
const tag = process.env.TAG ?? 'after'
for (const [s, o] of Object.entries({ D: { viewport: { width: 1440, height: 900 } }, P: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } })) {
  const p = await b.newPage(o)
  await p.goto(`${process.env.BASE ?? 'http://localhost:4180'}/games/`)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${tag}-games-${s}.png` })
  await p.screenshot({ path: `${out}/${tag}-games-${s}-full.png`, fullPage: true })
  await p.close()
}
await b.close()
// (the Cathnivore card's art at 2x, to read its region plates)
{
  const b2 = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
  const p = await b2.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await p.goto(`${process.env.BASE ?? 'http://localhost:4180'}/games/`)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${tag}-games-D-cathcard.png`, clip: { x: 105, y: 535, width: 300, height: 330 } })
  await b2.close()
}
