// Plan item 742, measure first: level 34 (2D, the sandbox) with a tower on every plot beside the lanes, cycling the
// level's kinds. Per tower its drawn box (renderer().towerRects(), CSS px) and its footprint, the box's lowest cell of
// height (where the sprite meets the ground). Reports pairs of footprints that meet, footprints over a lane cell, and
// each kind's drawn width in cells. Usage: a dist-site preview on :4175, then node scripts/hedgerow-742-measure.mjs
import { chromium } from 'playwright'
const base = process.env.SITE_URL ?? 'http://localhost:4175'
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
for (const [name, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ baseURL: base, viewport: vp, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) })
  const page = await ctx.newPage()
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 34: true }, seen: {}, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=34')
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => {
    const h = window.hedgerow, g = h.game()
    const path = [...g.level.path, ...(g.level.path2 ?? [])]
    let n = 0
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) {
      if (!path.some(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r) === 1)) continue
      if (h.place(g, g.level.towers[n % g.level.towers.length], c, r).ok) n++
    }
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `e2e/screenshots/h742/before-${name}.png` })
  const m = await page.evaluate(() => {
    const h = window.hedgerow, g = h.game(), lv = g.level
    const boxes = h.renderer().towerRects()
    const a = h.cellCenter(0, 0), b2 = h.cellCenter(1, 0)
    const s = b2.x - a.x
    const lane = new Set([...lv.path, ...(lv.path2 ?? [])].map(([c, r]) => `${c},${r}`))
    const feet = g.towers.map((t, i) => { const bx = boxes[i]; return { kind: t.kind, c: t.col, r: t.row, x0: bx.x, x1: bx.x + bx.w, y0: bx.y + bx.h - s, y1: bx.y + bx.h, w: bx.w / s } })
    const meet = (p, q) => p.x0 < q.x1 - 0.5 && p.x1 > q.x0 + 0.5 && p.y0 < q.y1 - 0.5 && p.y1 > q.y0 + 0.5
    let pairs = 0, onLane = 0
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) if (meet(feet[i], feet[j])) pairs++
    for (const f of feet) {
      const cc = h.cellCenter(f.c, f.r)
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
        if (!lane.has(`${f.c + dc},${f.r + dr}`)) continue
        const q = { x0: cc.x + dc * s - s / 2, x1: cc.x + dc * s + s / 2, y0: cc.y + dr * s - s / 2, y1: cc.y + dr * s + s / 2 }
        const ox = Math.min(f.x1, q.x1) - Math.max(f.x0, q.x0), oy = Math.min(f.y1, q.y1) - Math.max(f.y0, q.y0)
        if (ox > 2 && oy > 2) onLane++
      }
    }
    const kinds = {}
    for (const f of feet) kinds[f.kind] = Math.max(kinds[f.kind] ?? 0, +f.w.toFixed(2))
    return { towers: feet.length, cell: +s.toFixed(1), pairs, onLane, widthCells: kinds }
  })
  console.log(name, JSON.stringify(m))
  await ctx.close()
}
await b.close()
