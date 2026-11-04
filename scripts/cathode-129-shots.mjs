// Plan item 129: the desktop class pick, every class at D (1440x900) and L (844x390), with her face box measured.
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'before'
const port = process.env.PORT ?? '4186'
const only = process.env.SIZES?.split(',')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [s, w, h] of [['D', 1440, 900], ['L', 844, 390]]) {
  if (only && !only.includes(s)) continue
  for (const cls of (process.env.CLASSES ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: s === 'L' })
    const p = await ctx.newPage()
    await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await p.goto(`http://localhost:${port}/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
    await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 150_000 })
    await p.waitForTimeout(1500)
    const m = await p.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round) }
      const f = window.cathodeFront.scene().faceBox()
      return { face: [f.left, f.top, f.right, f.bottom].map(Math.round), sheet: box('.cp-sheet'), list: box('.cp-left') }
    })
    console.log(tag, s, cls, JSON.stringify(m), 'faceH', m.face[3] - m.face[1])
    await p.screenshot({ path: `e2e/screenshots/c129/${tag}-${s}-${cls}.png` })
    await ctx.close()
  }
}
await b.close()
