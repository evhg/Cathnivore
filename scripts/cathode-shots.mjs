// ROADMAP 101: in-game CATHODE screenshots (?play&shot skips the 18+ gate) at phone and desktop sizes.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathode-shots.mjs
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
for (const [name, w, h] of [['phone', 844, 390], ['desktop', 1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(`${base}?play&shot`)
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `e2e/screenshots/${name}-cathode-game.png`, timeout: 180_000 })
  await page.close()
}
await browser.close()
