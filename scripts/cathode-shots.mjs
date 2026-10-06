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
// ROADMAP 97: touch layout (hasTouch) with button size and overlap report.
const tctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
const tp = await tctx.newPage()
await tp.goto(`${base}?play&shot`)
await tp.waitForTimeout(8000)
const report = await tp.evaluate(() => {
  const sel = '.tbtn, .stick, .hud-health, .health, [class*=plate]'
  return [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect()
    return `${e.className} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
  })
})
console.log(report.join('\n'))
await tp.screenshot({ path: 'e2e/screenshots/phone-touch-cathode-game.png', timeout: 180_000 })
await tctx.close()
await browser.close()
