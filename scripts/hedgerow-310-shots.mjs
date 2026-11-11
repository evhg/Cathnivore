// Plan item 310: Hedgerow l21 in 3D at D and P (DPR 3) with a crop round Cath. A dist-site preview on :4190.
//   OUT=<dir> [POSE=point|wave] node scripts/hedgerow-310-shots.mjs  (POSE waits for that pose before the shot)
import { chromium } from '@playwright/test'
const out = process.env.OUT, level = 21
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const [n, w, h] of [['D', 1440, 900], ['P', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: n !== 'D', isMobile: n !== 'D' })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:4190/hedgerow/?sandbox=1`)
  await page.evaluate(([l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: t })), [level, TIPS])
  await page.goto(`http://localhost:4190/hedgerow/?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game() && !!window.hedgerow3d, null, { timeout: 90000 })
  await page.waitForTimeout(25000)
  // At P the close frame leaves her post out (item 215): the Whole field view shows her.
  if (n === 'P') { await page.getByRole('button', { name: /whole field/i }).click().catch(() => {}); await page.waitForTimeout(8000) }
  let box = await page.evaluate(() => window.hedgerow3d.cathScreenBox?.() ?? null)
  console.log(n, JSON.stringify(box))
  if (process.env.POSE) await page.locator('#stage[data-cath-pose="' + process.env.POSE + '"]').waitFor({ timeout: 60000 }).catch(() => console.log('no pose'))
  await page.screenshot({ path: `${out}/${n}.png`, timeout: 120000 })
  const fixed = null
  if (fixed) await page.screenshot({ path: `${out}/${n}-cath.png`, clip: fixed, timeout: 120000 })
  else if (box) { const x = Math.max(0, box.x - box.w * 0.6), y = Math.max(0, box.y - box.h * 0.2); await page.screenshot({ path: `${out}/${n}-cath.png`, clip: { x, y, width: Math.min(w - x, box.w * 2.2), height: Math.min(h - y, box.h * 1.4) }, timeout: 120000 }) }
  await ctx.close()
}
await b.close()
