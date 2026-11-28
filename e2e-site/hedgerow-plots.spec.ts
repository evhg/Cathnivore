import { expect, test } from '@playwright/test'

// Plan item 742: on level 34's field (2D, the sandbox) with a grown tower on every plot beside the lanes, cycling the
// level's kinds, every tower's solid foot (its plinth, footing, hedge or walls: renderer().footRects()) stays on its
// own plot: no two feet meet and none reaches over a lane cell. Before, the 1.4x field scale drew tier-3 plinths 1.2
// cells wide and the hedge 1.8, so neighbours' plinths merged and the hedges and ponds spilled onto the road.
type R = { x: number; y: number; w: number; h: number }
type HG = {
  game(): {
    level: { path: number[][]; path2?: number[][]; rows: number; cols: number; towers: string[] }
    towers: Array<{ id: number; col: number; row: number }>
  }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  upgrade(g: unknown, id: number, spec?: number): { ok: boolean }
  cellCenter(c: number, r: number): { x: number; y: number } | null
  renderer(): { footRects(): R[]; canvas: HTMLCanvasElement }
}

test('level 34 grown towers: each foot on its own plot, off the lane', async ({ page }) => {
  test.setTimeout(150_000)
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 34: true }, seen: {}, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&2d&level=34')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const path = [...g.level.path, ...(g.level.path2 ?? [])]
    let n = 0
    for (let r = 0; r < g.level.rows; r++)
      for (let c = 0; c < g.level.cols; c++) {
        if (!path.some(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r) === 1)) continue
        if (h.place(g, g.level.towers[n % g.level.towers.length]!, c, r).ok) n++
      }
    for (let i = 0; i < 2; i++) for (const t of g.towers) h.upgrade(g, t.id, 0)
  })
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const cr = h.renderer().canvas.getBoundingClientRect()
    const cell = (c: number, r: number) => {
      const p = h.cellCenter(c, r)!
      return { x: p.x - cr.left, y: p.y - cr.top }
    }
    const s = cell(1, 0).x - cell(0, 0).x
    const feet = h.renderer().footRects()
    const own = new Set(g.towers.map((t) => `${t.col},${t.row}`))
    const lane = [...g.level.path, ...(g.level.path2 ?? [])].filter(([c, r]) => !own.has(`${c},${r}`))
    const over = (a: R, b: R) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5
    const pairs: string[] = []
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) if (over(feet[i]!, feet[j]!)) pairs.push(`${i}-${j}`)
    const onLane: string[] = []
    feet.forEach((f, i) => {
      for (const [c, r] of lane) {
        const q = cell(c!, r!)
        if (over(f, { x: q.x - s / 2, y: q.y - s / 2, w: s, h: s })) onLane.push(`${i}@${c},${r}`)
      }
    })
    return { towers: g.towers.length, feet: feet.length, pairs, onLane, widest: Math.max(...feet.map((f) => f.w / s)) }
  })
  expect(m.towers).toBeGreaterThan(10)
  expect(m.feet).toBe(m.towers)
  expect(m.pairs).toEqual([])
  expect(m.onLane).toEqual([])
  expect(m.widest).toBeLessThanOrEqual(0.92)
})
