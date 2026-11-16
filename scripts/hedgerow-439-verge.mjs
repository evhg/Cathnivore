// Plan item 439: an upright phone's 3D field at several levels, shot, with the verge measured as a share of the canvas:
// the canvas rows the field spans, less the field's projected quad on them (the grey grass beside the lane), over the
// whole canvas. Also Cath's box and whether every plot is in view.
//   npx vite preview --outDir dist-site --port 4186 &  OUT=<dir> node scripts/hedgerow-439-verge.mjs  (LEVELS=5,21 SIZES=P)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4186/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/a439'
const levels = (process.env.LEVELS ?? '5,21,34,40').split(',').map(Number)
const sizes = (process.env.SIZES ?? 'P').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
for (const size of sizes) for (const level of levels) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
  const page = await ctx.newPage()
  await page.goto(`${base}?sandbox=1`)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${base}?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game() && !!window.hedgerow3d, null, { timeout: 90000 })
  await page.waitForFunction(() => window.hedgerow.camSettled(), null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const m = await page.evaluate(() => {
    const c = document.getElementById('canvas').getBoundingClientRect()
    const hg = window.hedgerow
    const plots = hg.plotBoxes()
    const all = plots.every((b) => b.x >= c.left - 1 && b.y >= c.top - 1 && b.x + b.w <= c.right + 1 && b.y + b.h <= c.bottom + 1)
    const x0 = Math.min(...plots.map((b) => b.x)), x1 = Math.max(...plots.map((b) => b.x + b.w))
    const y0 = Math.min(...plots.map((b) => b.y)), y1 = Math.max(...plots.map((b) => b.y + b.h))
    // Side verge: on each canvas row the plots span, the width left and right of the plots' union, over the canvas.
    let side = 0
    for (let y = Math.max(c.top, y0); y < Math.min(c.bottom, y1); y++) {
      const row = plots.filter((b) => b.y <= y && b.y + b.h > y)
      if (!row.length) continue
      const l = Math.max(c.left, Math.min(...row.map((b) => b.x))), r = Math.min(c.right, Math.max(...row.map((b) => b.x + b.w)))
      side += Math.max(0, l - c.left) + Math.max(0, c.right - r)
    }
    // The field's own quad (its corners projected through the live, settled camera): the share of the canvas beside it.
    const r = window.hedgerow3d
    const { x: cols, y: rows } = r.fieldSize
    const V = r.camera.position.constructor
    const q = [[0, 0], [cols, 0], [cols, rows], [0, rows]].map(([x, z]) => {
      const p = new V(x, 0, z).project(r.camera)
      return { x: c.left + ((p.x + 1) / 2) * c.width, y: c.top + ((1 - p.y) / 2) * c.height }
    })
    const edgeX = (a, b, y) => (a.y === b.y ? null : (y - a.y) / (b.y - a.y) >= 0 && (y - a.y) / (b.y - a.y) <= 1 ? a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x) : null)
    let quadSide = 0
    for (let y = c.top; y < c.bottom; y++) {
      const xs = [0, 1, 2, 3].map((i) => edgeX(q[i], q[(i + 1) % 4], y + 0.5)).filter((v) => v !== null)
      if (xs.length < 2) continue
      const l = Math.max(c.left, Math.min(...xs)), rr = Math.min(c.right, Math.max(...xs))
      quadSide += Math.max(0, l - c.left) + Math.max(0, c.right - rr)
    }
    const fieldVerge = +(quadSide / (c.width * c.height)).toFixed(3)
    const hook = +hg.fieldVerge().toFixed(4)
    const quad = q.map((p) => [Math.round(p.x), Math.round(p.y)])
    const cath = hg.cathBox()
    return { canvas: [Math.round(c.width), Math.round(c.height)], plots: [x0, y0, x1, y1].map(Math.round), all, plotVerge: +(side / (c.width * c.height)).toFixed(3), fieldVerge, hook, quad, cath: cath && { h: Math.round(cath.h), inside: cath.x >= c.left && cath.y >= c.top && cath.x + cath.w <= c.right && cath.y + cath.h <= c.bottom } }
  })
  console.log(size, level, JSON.stringify(m))
  await page.screenshot({ path: `${out}/l${level}-${size}.png` })
  await ctx.close()
}
await browser.close()
