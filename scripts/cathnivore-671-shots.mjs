import { chromium } from '@playwright/test'
const S = process.argv[2]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const p = await ctx.newPage()
await p.goto('http://localhost:4191/?opening')
await p.locator('.title-cath svg').waitFor()
await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()))
for (const t of [300, 500, 700]) {
  await p.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t)
  await p.screenshot({ path: `${S}/deal-${t}.png` })
}
const c2 = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true })
const p2 = await c2.newPage(); await p2.goto('http://localhost:4191/'); await p2.waitForTimeout(2000)
await p2.screenshot({ path: `${S}/a3-375.png` })
await b.close()
