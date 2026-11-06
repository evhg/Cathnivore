// Plan item 180: Cath posed as each class on the class pick, at D and P (held stance, ?shot).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-pose-shots.mjs [tag] [D,P]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const which = (process.argv[3] ?? 'D,P').split(',')
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { P: { width: 390, height: 844 }, D: { width: 1440, height: 900 } }
const dir = 'e2e/screenshots/p180'
for (const n of which) {
  const ctx = await b.newContext({ viewport: sizes[n], hasTouch: n !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  for (const cls of ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']) {
    await p.goto(`${base}?front=classpick&shot&t=8&class=${cls}${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    await p.waitForTimeout(3000)
    await p.screenshot({ path: `${dir}/${tag}-${n}-${cls}.png`, timeout: 240000 })
  }
  await ctx.close()
}
await b.close()
