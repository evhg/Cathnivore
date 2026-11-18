// Plan item 319: shoots the NIGHT SHIFT class pick at D with a close crop of Cath's posing (left) hand, at DPR (env DPR, 4).
// Needs a dist-site preview on :4190 (env PORT). Usage: OUT=<dir> CLASS=ghost node scripts/cathode-hand-zoom.mjs <tag>
import { chromium } from '@playwright/test'
const [tag] = process.argv.slice(2)
const out = process.env.OUT, port = process.env.PORT || 4190
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR || 4) })
const p = await ctx.newPage()
await p.goto(`http://localhost:${port}/nightshift/?shot`)
await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
for (const cls of (process.env.CLASS || 'ghost').split(',')) {
  await p.goto(`http://localhost:${port}/nightshift/?front=classpick&shot&t=8&quality=phone&class=${cls}`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(Number(process.env.WAIT || 15000))
  const f = await p.evaluate(() => window.cathodeFront.scene().faceBox())
  const w = f.right - f.left, h = f.bottom - f.top
  console.log(cls, JSON.stringify(f))
  // One full frame at device scale (a clipped shot at DPR 4 re-renders the scene darker); crop the hands with
  // scripts/crop.py (the face box is printed above, in CSS px).
  await p.screenshot({ path: `${out}/${tag}-${cls}-full.png`, timeout: 180000 })
  await p.screenshot({ path: `${out}/${tag}-${cls}-D.png`, scale: 'css', timeout: 180000 })
}
await b.close()
