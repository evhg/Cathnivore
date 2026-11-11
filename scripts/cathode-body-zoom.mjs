// Plan item 319: shoots the NIGHT SHIFT title or class pick at D and P with a crop of Cath's whole figure (coat, gloves).
// Needs a dist-site preview on :4190. Usage: OUT=<dir> CLASS=ghost node scripts/cathode-body-zoom.mjs <tag> [title|classpick]
import { chromium } from '@playwright/test'
const [tag, front = 'title'] = process.argv.slice(2)
const out = process.env.OUT
const cls = process.env.CLASS || 'ghost'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  if (process.env.ONLY && process.env.ONLY !== n) continue
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: Number(process.env.DPR || 2) })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4190/nightshift/?shot')
  await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`http://localhost:4190/nightshift/?front=${front}&shot&t=${process.env.T || 8}&quality=phone${front === 'classpick' ? `&class=${cls}` : ''}`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(3000)
  const g = await p.evaluate(() => window.cathodeFront.scene().figureBox(true))
  await p.screenshot({ path: `${out}/${tag}-${front}-${n}.png`, scale: 'css', timeout: 180000 })
  const x = Math.max(0, g.left - 10), y = Math.max(0, g.top - 10)
  const w = Math.min(vp.width - x, g.right - g.left + 20), h = Math.min(vp.height - y, g.bottom - g.top + 20)
  await p.screenshot({ path: `${out}/${tag}-${front}-${n}-body.png`, clip: { x, y, width: w, height: h }, timeout: 180000 })
  console.log(n, front, cls, JSON.stringify(g))
  await ctx.close()
}
await b.close()
