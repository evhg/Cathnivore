// Plan item 53: the Settings screen's Sound block at P (390x844) and D (1440x900).
// Usage: npm run build && npx vite preview --outDir dist --port 4192 &
//        BASE=http://localhost:4192/ OUT=e2e/screenshots/sound53 TAG=after node scripts/settings-sound-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4192/'
const out = process.env.OUT ?? 'e2e/screenshots/sound53'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, w, h] of [['P', 390, 844], ['D', 1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: name === 'P', isMobile: name === 'P' })
  await page.goto(base)
  await page.getByRole('button', { name: /settings/i }).first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/settings-${tag}-${name}.png`, fullPage: true })
  await page.close()
}
await browser.close()
