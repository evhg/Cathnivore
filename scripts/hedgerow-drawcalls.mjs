// Plan item 52: draw calls per frame and frames per second of Hedgerow's 3D field at a size, in `?sandbox=1`
// with nothing built (counted by wrapping the WebGL draw functions). Compare before and after a 3D art change.
// Usage: HEDGEROW_URL=http://localhost:4180/hedgerow/ SIZE=P LEVEL=13 node scripts/hedgerow-drawcalls.mjs
import { chromium } from '@playwright/test'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const level = Number(process.env.LEVEL ?? 13)
const SIZES = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const [w, h] = SIZES[process.env.SIZE ?? 'P']
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 })
await ctx.addInitScript(() => {
  window.__calls = 0
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype])
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = P[f]
      if (o) P[f] = function (...a) { window.__calls++; return o.apply(this, a) }
    }
})
const page = await ctx.newPage()
await page.goto(`${base}?sandbox=1`)
await page.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), level)
await page.goto(`${base}?sandbox=1&level=${level}${process.env.QUERY ?? ''}`)
await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
await page.waitForTimeout(8000)
const r = await page.evaluate(() => new Promise((res) => {
  let frames = 0
  const c0 = window.__calls
  const t0 = performance.now()
  const tick = () => {
    frames++
    if (performance.now() - t0 < 5000) requestAnimationFrame(tick)
    else res({ frames, calls: (window.__calls - c0) / frames, fps: frames / ((performance.now() - t0) / 1000) })
  }
  requestAnimationFrame(tick)
}))
console.log(JSON.stringify({ level, size: `${w}x${h}`, callsPerFrame: Math.round(r.calls), fps: +r.fps.toFixed(1) }))
await browser.close()
