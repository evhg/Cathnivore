// Plan item 40: NIGHT SHIFT's front-door bugs. The ?front=classpick stage at P, D and L (the list over the
// menu; the phone's stats with no scroll cue), and the title's case board at L (leads and Back cut off).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-front-fix-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { P: { width: 390, height: 844 }, D: { width: 1440, height: 900 }, L: { width: 844, height: 390 } }
const report = (p, sel) => p.evaluate((sel) => {
  // Every visible element inside `sel` that ends outside the viewport or whose text is clipped by its scroller.
  const root = document.querySelector(sel)
  if (!root) return 'missing ' + sel
  const out = []
  for (const e of root.querySelectorAll('button, h1, h2, h3, p, li, .case-flag, .case-print')) {
    const r = e.getBoundingClientRect()
    if (!r.width || getComputedStyle(e).visibility === 'hidden') continue
    if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1) out.push(`${e.tagName}.${e.className} ${Math.round(r.top)}..${Math.round(r.bottom)}`)
  }
  const sc = [...root.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map((e) => `${e.className} ${e.clientHeight}/${e.scrollHeight}`)
  return { offscreen: out.slice(0, 12), scrollers: sc }
}, sel)
for (const [n, vp] of Object.entries(sizes)) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: n !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto(`${base}?front=classpick&shot&t=8&class=ghost${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
  await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
  await p.waitForTimeout(4000)
  console.log(n, 'classpick', JSON.stringify(await report(p, '.cp')))
  await p.screenshot({ path: `e2e/screenshots/front-${tag}-${n}-classpick.png`, timeout: 240000 })
  if (n === 'L' || n === 'P') {
    await p.goto(`${base}?front=title&shot&t=8&quality=phone`, { timeout: 180000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    await p.waitForTimeout(2000)
    await p.evaluate(() => document.querySelector('#btn-cases')?.click())
    await p.waitForSelector('.case-board', { timeout: 60000 })
    await p.waitForTimeout(3000)
    console.log(n, 'caseboard', JSON.stringify(await report(p, '.case-board')))
    await p.screenshot({ path: `e2e/screenshots/front-${tag}-${n}-caseboard.png`, timeout: 240000 })
  }
  await ctx.close()
}
await b.close()
