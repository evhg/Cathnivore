// Plan item 457: the class pick's draw calls and triangles per class (phone quality at 390x844, high at 1440x900),
// from `?front=classpick&shot&class=<id>`. Calls are deterministic under SwiftShader; run alone.
//   node scripts/cathode-pick-calls.mjs http://localhost:<port>/nightshift/
import { chromium } from '@playwright/test'
const base = process.argv[2] ?? 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [s, w, h, q] of [['P', 390, 844, 'phone'], ['D', 1440, 900, 'high']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: s === 'P' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const out = {}
  for (const cls of ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']) {
    const p = await ctx.newPage()
    await p.goto(`${base}?front=classpick&shot&t=8&quality=${q}&class=${cls}`, { timeout: 180_000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 400_000 })
    await p.waitForTimeout(2500)
    out[cls] = await p.evaluate(() => {
      const sc = window.cathodeFront.scene()
      sc.setTime(8.5)
      return [sc.stats.drawCalls, sc.stats.triangles ?? null]
    })
    await p.close()
  }
  console.log(s, JSON.stringify(out))
  await ctx.close()
}
await b.close()
