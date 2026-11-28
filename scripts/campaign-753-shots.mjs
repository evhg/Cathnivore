// Plan item 753: the campaign atlas with a chapter chosen (the road drawn from Cath's stop), at P (390x844, 2x) and D,
// with chapter 1 won. Usage: npx vite preview --outDir dist-site --port 4186 &  OUT=<dir> node scripts/campaign-753-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4186/cathnivore/'
const out = process.env.OUT ?? 'e2e/screenshots/c753'
const key = 'cathnivore:campaign:v1'
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of Object.entries(SIZES)) {
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })), key)
  await p.goto(base)
  await p.getByText('Campaign', { exact: false }).first().click()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/campaign-rest-${s}.png` })
  if (s === 'P') await p.locator('.cmp-tab').nth(4).click()
  else await p.locator('.cmp-path > .cmp-stop').nth(4).locator('.cmp-card').hover()
  await p.waitForTimeout(250)
  await p.screenshot({ path: `${out}/campaign-mid-${s}.png` })
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${out}/campaign-pick-${s}.png` })
  console.log(s, await p.locator('.cmp-map-route').count())
  await ctx.close()
}
await browser.close()
