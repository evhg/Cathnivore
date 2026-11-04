// Plan item 106: Bea's garden dry and watered at P and D, light and dark. Needs a dist-site preview on :4180.
// OUT=e2e/screenshots/r106 node scripts/runnel-106-shots.mjs
import { chromium } from '@playwright/test'
const out = process.env.OUT
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of ['light', 'dark'])
for (const [s, o] of [['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['D', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
  const p = await b.newPage({ ...o, colorScheme: scheme })
  await p.addInitScript(() => { if (!localStorage.getItem('runnel:v1')) localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 3, seenHelp: true })) })
  await p.goto('http://localhost:4180/runnel/?shotsolve'); await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/r106-dry-${scheme}-${s}.png` })
  await p.locator('[data-last]').click(); await p.waitForTimeout(2100)
  await p.screenshot({ path: `${out}/r106-wet-${scheme}-${s}.png` })
  const r = await p.locator('.bea-garden').boundingBox()
  await p.waitForTimeout(1000)
  await p.screenshot({ path: `${out}/r106-wetzoom-${scheme}-${s}.png`, clip: { x: r.x - 60, y: r.y - 30, width: r.width + 70, height: r.height + 40 } })
  await p.close()
}
await b.close()
