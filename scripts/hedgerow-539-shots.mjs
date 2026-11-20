// Plan item 539: level 21 in 3D, the queue at the gate and then a round on the lane, P and D, plus the
// scene-graph measures (wheels and materials per vehicle, distinct crop geometries, the phone's top band).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/h539 node scripts/hedgerow-539-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/h539'
const level = Number(process.env.LEVEL ?? 21)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const [s, o] of Object.entries(SIZES)) {
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate(([l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [String(l)]: true }, seen: Object.fromEntries(['van','drone','truck','influencer','courier','hatchback','wrapped','phantom','lawyer','lobbyist'].map((k) => [k, true])), tips: t })), [level, tips])
  await p.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await p.waitForFunction(() => window.hedgerow.camSettled?.() ?? true, null, { timeout: 60000 })
  await p.evaluate(() => { const h = window.hedgerow; const g = h.game(); for (const [c, r] of [[2, 2], [3, 4], [4, 6], [0, 4]]) h.place(g, 'scarecrow', c, r) })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/l${level}-queue-${s}.png` })
  // the phone's top band (the top 15% of the canvas): its mean luminance, which fog and bloom blew toward white
  const band = await p.evaluate(() => {
    const c = document.getElementById('canvas'); const r = c.getBoundingClientRect()
    return { y: r.top, h: r.height * 0.15, x: r.left, w: r.width }
  })
  const buf = await p.screenshot({ clip: { x: band.x, y: band.y, width: band.w, height: band.h } })
  const lum = await p.evaluate(async (d) => {
    const i = new Image(); i.src = d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height
    const g = c.getContext('2d'); g.drawImage(i, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    let sum = 0; for (let k = 0; k < px.length; k += 4) sum += 0.2126 * lin(px[k]) + 0.7152 * lin(px[k + 1]) + 0.0722 * lin(px[k + 2])
    return sum / (px.length / 4)
  }, 'data:image/png;base64,' + buf.toString('base64'))
  console.log(s, 'top band luminance', lum.toFixed(3))
  await p.evaluate(() => { const h = window.hedgerow; h.sendWave(h.game(), true) })
  await p.waitForTimeout(9000)
  await p.screenshot({ path: `${out}/l${level}-wave-${s}.png` })
  const m = await p.evaluate(() => window.hedgerow.lookStats?.() ?? null)
  console.log(s, JSON.stringify(m))
  await ctx.close()
}
await browser.close()
