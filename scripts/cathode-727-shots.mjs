// Plan item 727: title frames of Cath at D and P with a crop of her shoulders and back (the hair over the coat), at
// loop times 0, 9 and 18 s. Usage: a dist-site preview on PORT (default 4180), then
//   node scripts/cathode-727-shots.mjs <outdir> [tag]
import { chromium } from '@playwright/test'
const out = process.argv[2] ?? 'e2e/screenshots', tag = process.argv[3] ?? 'after', port = process.env.PORT ?? 4180
const VP = { D: { width: 1440, height: 900 }, P: { width: 390, height: 844 } }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of Object.entries(VP)) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: n === 'P' ? 3 : 1, ...(n === 'P' ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${port}/nightshift/?front=title&shot`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(3000)
  for (const t of [0, 9, 18]) {
    await p.evaluate((t) => window.cathodeFront.scene().setTime(t), t)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${tag}-${n}-t${t}.png` })
    const f = await p.evaluate(() => window.cathodeFront.scene().figureBox())
    const h = f.bottom - f.top
    const clip = { x: Math.max(0, f.left - h * 0.05), y: Math.max(0, f.top), width: Math.min(vp.width - Math.max(0, f.left - h * 0.05), f.right - f.left + h * 0.1), height: Math.min(h * 0.45, vp.height - f.top) }
    await p.screenshot({ path: `${out}/${tag}-${n}-t${t}-shoulders.png`, clip })
  }
  await ctx.close()
}
await b.close()
