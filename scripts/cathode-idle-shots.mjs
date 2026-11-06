// Plan item 175: the NIGHT SHIFT front door (title and class pick) at D, P and L, for Cath's idle and seams.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-idle-shots.mjs [tag] [D,P,L]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const which = (process.argv[3] ?? 'D,P,L').split(',')
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { P: { width: 390, height: 844 }, D: { width: 1440, height: 900 }, L: { width: 844, height: 390 } }
const dir = 'e2e/screenshots/i175'
for (const n of which) {
  const vp = sizes[n]
  const ctx = await b.newContext({ viewport: vp, hasTouch: n !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  for (const stage of ['title', 'classpick']) {
    await p.goto(`${base}?front=${stage}&shot&t=8&class=ghost${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `${dir}/${tag}-${n}-${stage}.png`, timeout: 240000 })
  }
  await ctx.close()
}
await b.close()
