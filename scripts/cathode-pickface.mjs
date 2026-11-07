// Plan item 247: measures Cath's face box on the desktop class pick for every class (1440x900), and shoots each.
// Usage: node scripts/cathode-pickface.mjs <base-url> <out-dir> [tag]
import { chromium } from '@playwright/test'
const [base = 'http://localhost:4191', out = '.', tag = 'm'] = process.argv.slice(2)
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.goto(`${base}/nightshift/?shot`)
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
})
for (const cls of (process.env.CLASSES || 'ghost,gunslinger,wirewitch,butcher,fixer').split(',')) {
  await p.goto(`${base}/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 150_000 })
  const f = await p.evaluate(() => window.cathodeFront.scene().faceBox())
  const g = await p.evaluate(() => window.cathodeFront.scene().figureBox(true))
  console.log(cls, 'face', Math.round(f.right - f.left), 'x', Math.round(f.bottom - f.top), 'at', Math.round(f.left), Math.round(f.top), '| body', Math.round(g.left), Math.round(g.top), Math.round(g.right), Math.round(g.bottom))
  await p.waitForTimeout(Number(process.env.WAIT || 6000))
  await p.screenshot({ path: `${out}/${tag}-${cls}-D.png` })
}
await b.close()
