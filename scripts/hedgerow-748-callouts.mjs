// Plan item 748: how often a live 3D callout ('+N', 'CRIT!') or a tower's pooled '+N' mark overlaps a tower's screen box at level 27, over a fight.
// (A mark is checked against its own tower: tall towers behind it, the windmill's sails, may stand under it.)
// BASE (default http://localhost:4175), SIZE=D|P.
import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4175'
const size = process.env.SIZE ?? 'D'
const vp = size === 'P' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } }
const b = await chromium.launch()
const p = await b.newPage(vp)
await p.goto(`${base}/hedgerow/?2d`)
await p.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 27: true } })))
await p.goto(`${base}/hedgerow/?sandbox=1&level=27`)
await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
await p.waitForTimeout(5000)
await p.evaluate(() => {
  const hg = window.hedgerow, g = hg.game()
  const path = [...(g.level.path ?? []), ...(g.level.path2 ?? [])]
  const near = (c, r) => Math.min(...path.map(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r)))
  const spots = []
  for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
  const cover = (c, r) => path.filter(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 2.2).length
  spots.sort((a, b) => (a[0] > 1) - (b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
  let n = 0
  for (const [, c, r] of spots) { if (n >= 8) break; if (hg.place(g, g.level.towers[n % g.level.towers.length], c, r).ok) n++ }
  hg.arm?.(g); hg.sendWave(g, true)
})
for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('.intro:not([hidden]) .intro-go')?.click()) }
await p.evaluate(() => window.hedgerow.warp?.(window.hedgerow.game(), 7))
let seen = 0, over = 0
const bad = []
for (let i = 0; i < 120; i++) {
  await p.waitForTimeout(100)
  const r = await p.evaluate(() => window.hedgerow.callouts())
  if (!r) continue
  for (const c of [...r.callouts, ...(r.marks ?? []).map((m) => ({ ...m, text: 'mark' }))]) {
    if (c.w === 0) continue
    seen++
    const hit = c.own ? [c.own].find((t) => c.x < t.x + t.w && c.x + c.w > t.x && c.y < t.y + t.h && c.y + c.h > t.y) : r.towers.find((t) => c.x < t.x + t.w && c.x + c.w > t.x && c.y < t.y + t.h && c.y + c.h > t.y)
    if (hit) { over++; if (bad.length < 8) bad.push({ text: c.text, c: [c.x, c.y, c.w, c.h].map(Math.round), t: [hit.x, hit.y, hit.w, hit.h].map(Math.round) }) }
  }
}
console.log(JSON.stringify({ size, seen, over, bad }))
await b.close()
