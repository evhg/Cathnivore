// Plan item 29: the NIGHT SHIFT HUD at D and L, fresh in the market: the compass, the weapon block and a subtitle,
// with the subtitle's box measured against the central 30% rectangle.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-hud-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['L', { width: 844, height: 390 }]]) {
  const ctx = await b.newContext({ viewport: vp })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/nightshift/?play&class=gunslinger' + (n === 'L' ? '&rs=0.75&quality=phone' : ''))
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 5, null, { timeout: 240000 })
  await p.waitForTimeout(8000)
  await p.evaluate(() => window.cathode.hud.subtitle('Cath: Somebody in this market knows where the Widowmaker went, and he is going to tell me.'))
  await p.waitForTimeout(2500)
  const info = await p.evaluate(() => {
    const r = document.querySelector('.hud-sub')?.getBoundingClientRect()
    const W = innerWidth, H = innerHeight
    const c = { l: W * 0.35, r: W * 0.65, t: H * 0.35, b: H * 0.65 }
    const meets = r ? !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) : null
    return { sub: r && { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }, centre: c, meets, mag: document.querySelector('.hud-mag')?.textContent, tick: document.querySelector('.hud-compass-tick')?.getAttribute('data-x') }
  })
  console.log(n, JSON.stringify(info))
  await p.screenshot({ path: `e2e/screenshots/hud-${tag}-${n}.png`, timeout: 240000 })
  await ctx.close()
}
await b.close()
