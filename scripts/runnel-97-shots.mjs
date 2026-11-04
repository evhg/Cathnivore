// Plan item 97: the daily's ditches and the water front, before and after a tap, at P and D, light and dark.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4175 &
//        OUT=e2e/screenshots/r97/after node scripts/runnel-97-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4175'
const out = process.env.OUT ?? 'e2e/screenshots/r97'
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of Object.entries(SIZES)) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...o, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(`${base}/runnel/?nohelp`)
    await p.waitForSelector('#board .tiles > g.cell')
    await p.waitForTimeout(1800)
    await p.screenshot({ path: `${out}/daily-${s}-${scheme}.png` })
    const i = await p.locator('#board .tiles > g.cell:not(.spring):not(.fixed):not(.locked):not(.reservoir)').first().evaluate((g) => [...g.parentElement.children].indexOf(g))
    await p.locator('#board .tiles > g.cell').nth(i).click()
    await p.waitForTimeout(380)
    await p.screenshot({ path: `${out}/tap-${s}-${scheme}-380ms.png` })
    await p.waitForTimeout(1400)
    await p.screenshot({ path: `${out}/tap-${s}-${scheme}-after.png` })
    await ctx.close()
  }
}
await browser.close()
