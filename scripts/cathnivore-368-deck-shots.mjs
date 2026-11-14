// Plan item 368: the phone counter's Saving for deck, scrolled to its label (390x844 and 375x667, light and dark).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  OUT=... TAG=... node scripts/cathnivore-368-deck-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4180/cathnivore/'
const out = process.env.OUT ?? 'e2e/screenshots/i368'
const tag = process.env.TAG ?? 'x'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[390, 844], [375, 667]]) for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: scheme })
  await page.goto(base)
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('[data-hand-card]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
  const info = await page.evaluate(() => {
    const a = document.querySelector('.action-tray .actions'); a.style.scrollBehavior = 'auto'
    const head = a.querySelector('.action-head-later')
    a.scrollLeft = head.offsetLeft - 16
    const later = [...a.querySelectorAll('.action-head-later ~ .action-item')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.height)] })
    const hr = head.getBoundingClientRect()
    return { head: [Math.round(hr.left), Math.round(hr.width), Math.round(hr.height), head.textContent.trim()], later }
  })
  await page.waitForTimeout(400)
  if (scheme === 'light') console.log(w, h, JSON.stringify(info))
  const tray = await page.locator('.action-tray').boundingBox()
  await page.screenshot({ path: `${out}/deck-${w}x${h}-${scheme}-${tag}.png`, clip: { x: 0, y: tray.y, width: w, height: h - tray.y } })
  await page.close()
}
await browser.close()
