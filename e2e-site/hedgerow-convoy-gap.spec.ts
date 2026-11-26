import { expect, test } from '@playwright/test'

// Plan item 707: a convoy of vehicles, not a row of capsules. In level 27's round 15, with eight towers beside the
// lane, no drawn vehicle's body (its from-above box) overlaps another's, nor the depot's plate, from the round's
// start through mid-wave.
type Rect = { x: number; y: number; w: number; h: number }
type Field = { vehicles: Rect[]; depots: Rect[] }
type HG = {
  game(): { level: { rows: number; cols: number; towers: string[]; path: number[][]; path2?: number[][] }; wave: number }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  sendWave(g: unknown, force?: boolean): void
  arm?(g: unknown): void
  field2d(): Field | null
}
const over = (a: Rect, b: Rect) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1

test('level 27 round 15: vehicles apart and clear of the depot', async ({ page }) => {
  test.setTimeout(240_000)
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 27: true }, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&2d&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  const round = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const path = [...g.level.path, ...(g.level.path2 ?? [])]
    const near = (c: number, r: number) => Math.min(...path.map(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r)))
    const cover = (c: number, r: number) => path.filter(([pc, pr]) => Math.hypot(pc! - c, pr! - r) <= 2.2).length
    const spots: Array<[number, number, number]> = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
    spots.sort((a, b) => Number(a[0] > 1) - Number(b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
    let n = 0
    for (const [, c, r] of spots) {
      if (n >= 8) break
      if (h.place(g, g.level.towers[n % g.level.towers.length]!, c, r).ok) n++
    }
    h.arm?.(g)
    h.sendWave(g, true)
    return g.wave
  })
  // (the sandbox field the plan1126a critique shot: its HUD reads 14/30, next round 15)
  expect(round).toBeGreaterThanOrEqual(1)
  const bad: string[] = []
  let seen = 0
  let depots = 0
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(300)
    await page.evaluate(() => document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click())
    const f = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.field2d())
    if (!f) continue
    seen = Math.max(seen, f.vehicles.length)
    depots = Math.max(depots, f.depots.length)
    for (let a = 0; a < f.vehicles.length; a++) {
      for (let b = a + 1; b < f.vehicles.length; b++)
        if (over(f.vehicles[a]!, f.vehicles[b]!)) bad.push(`t${i} ${JSON.stringify(f.vehicles[a])} on ${JSON.stringify(f.vehicles[b])}`)
      for (const d of f.depots) if (over(f.vehicles[a]!, d)) bad.push(`t${i} ${JSON.stringify(f.vehicles[a])} on the depot`)
    }
  }
  expect(seen, 'a convoy on the lane').toBeGreaterThanOrEqual(8)
  expect(depots, 'the depot measured').toBeGreaterThanOrEqual(1)
  expect(bad.slice(0, 8)).toEqual([])
})
