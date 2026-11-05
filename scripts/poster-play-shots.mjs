// Plan item 145 shots: each /games/ poster mid-loop (hovered) at D, plus /games/ and / at P and D. Needs a dist-site preview on :4180.
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:4180/games/'); await p.waitForTimeout(2500)
for (const g of ['cathnivore', 'runnel', 'hedgerow', 'nightshift']) {
  await p.hover(`.hero-game-${g}`); await p.waitForTimeout(1700)
  await p.locator(`.hero-game-${g} .hero-game-art`).screenshot({ path: `e2e/screenshots/p145/${g}-a.png` })
  await p.waitForTimeout(1100)
  await p.locator(`.hero-game-${g} .hero-game-art`).screenshot({ path: `e2e/screenshots/p145/${g}-b.png` })
}
await p.mouse.move(5, 5); await p.waitForTimeout(800); await p.screenshot({ path: 'e2e/screenshots/p145/games-D.png' })
const q = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await q.goto('http://localhost:4180/games/'); await q.waitForTimeout(3500); await q.screenshot({ path: 'e2e/screenshots/p145/games-P.png' })
await q.goto('http://localhost:4180/'); await q.waitForTimeout(3500); await q.screenshot({ path: 'e2e/screenshots/p145/portfolio-P.png' })
await p.goto('http://localhost:4180/'); await p.waitForTimeout(3500); await p.screenshot({ path: 'e2e/screenshots/p145/portfolio-D.png' })
await b.close()
