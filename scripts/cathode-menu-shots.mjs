// Plan item 159: NIGHT SHIFT's title menu as a sign, at P and D (light-independent: the street is night).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-menu-shots.mjs <tag>
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { P: { width: 390, height: 844 }, D: { width: 1440, height: 900 } }
for (const [n, vp] of Object.entries(sizes)) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: n !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto(`${base}?front=title&shot&t=8${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
  await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
  await p.waitForTimeout(3000)
  console.log(n, JSON.stringify(await p.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round) }
    const fig = window.cathodeFront.scene()?.figureBox(true)
    return { menu: r(document.getElementById('menu')), rows: [...document.querySelectorAll('#menu .menu-item')].map((e) => r(e)), lit: document.getElementById('menu').dataset.lit, fig: fig && [fig.left, fig.top, fig.right, fig.bottom].map(Math.round) }
  })))
  await p.screenshot({ path: `e2e/screenshots/menu159/${tag}-${n}.png`, timeout: 240000 })
  await ctx.close()
}
await b.close()
