// Plan item 668: the class pick at D with each of the five roles, the figure box shot per role, and the share of
// pixels that differ (any channel > 24) between every pair inside the union of the figure boxes.
// QUALITY=high (default) CATHODE_URL=... node scripts/cathode-668-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/ns668'
mkdirSync(out, { recursive: true })
const url = process.env.CATHODE_URL ?? 'http://localhost:4175/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), process.env.QUALITY ?? 'high')
await p.goto(`${url}?play`)
await p.waitForFunction(() => document.querySelector('canvas')?.dataset.class, null, { timeout: 120000 }).catch(() => {})
await p.waitForTimeout(12000)
const classes = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
const boxes = {}
for (let k = 1; k <= 5; k++) {
  if (k > 1) { await p.keyboard.press(String(k)); await p.waitForTimeout(9000) }
  boxes[classes[k - 1]] = await p.evaluate(() => window.cathodeFront.scene().figureBox(true))
  await p.screenshot({ path: `${out}/${tag}-${classes[k - 1]}.png` })
}
console.log(JSON.stringify(boxes))
await b.close()
