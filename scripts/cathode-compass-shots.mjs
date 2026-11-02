// Plan item 29: the compass tape at D and L, fresh in the market (the objective's tick reported per shot).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-compass-shots.mjs
import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['L', { width: 844, height: 390 }]]) {
  const ctx = await b.newContext({ viewport: vp })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/nightshift/?play&class=gunslinger' + (n === 'L' ? '&rs=0.75&quality=phone' : ''))
  await p.waitForTimeout(45000)
  const info = await p.evaluate(() => ({ shown: !!document.querySelector('.hud-compass:not([hidden])'), tick: document.querySelector('.hud-compass-tick')?.getAttribute('data-x'), pts: [...document.querySelectorAll('.hud-compass-pt:not(.off)')].map((e) => e.textContent) }))
  console.log(n, JSON.stringify(info))
  await p.screenshot({ path: `e2e/screenshots/compass-${n}.png` })
  await ctx.close()
}
await b.close()
