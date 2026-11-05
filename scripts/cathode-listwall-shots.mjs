// Plan item 169: NIGHT SHIFT's title List wall at P, L and D (HOVER=1 hovers the third print, ONLY=DP picks sizes, RM=1 reduced motion).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-listwall-shots.mjs <tag>
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { D: { width: 1440, height: 900 }, P: { width: 390, height: 844 }, L: { width: 844, height: 390 } }
for (const [n, vp] of Object.entries(process.env.ONLY ? Object.fromEntries(Object.entries(sizes).filter(([k]) => process.env.ONLY.includes(k))) : sizes)) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: n !== 'D', reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto(`${base}?front=title&shot&t=8${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
  await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
  await p.waitForTimeout(2500)
  if (process.env.HOVER) {
    const m = p.locator('.the-list-wall .mug').nth(2)
    if (await m.isVisible()) { await m.hover(); await p.waitForTimeout(700) }
  }
  await p.screenshot({ path: `e2e/screenshots/ns169/${tag}-${n}.png`, timeout: 240000 })
  await ctx.close()
}
await b.close()
