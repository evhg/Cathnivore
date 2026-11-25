import { expect, test } from '@playwright/test'

// Plan item 684: the fleet drives the lane in single file. Level 34 (sandbox, 2D, no towers), round 15: ~180 vehicles
// out of two depots. Every vehicle drawn stands on a lane cell (two abreast put them over the plots either side), no
// column is a stack over the queue's leader (its head alone, in the file), and each column's chip counts the rest.
type Col = { dist: number; count: number; lane: number; at: number | null; chip: number | null; badged: boolean }
type HG = {
  game(): { wave: number; enemies: unknown[]; level: { path: number[][]; path2?: number[][] } }
  sendWave(g: unknown, force?: boolean): void
  convoy(): { drawn: number; column: number; cols: Col[]; places: Array<{ x: number; y: number }> } | null
}

test('a packed round drives in single file, the overflow counted on its chip', async ({ page, hasTouch }) => {
  test.setTimeout(240_000)
  const stars = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 34: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&level=34&2d')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    g.wave = 14
    h.sendWave(g, true)
  })
  // Close any field-guide page until the lane is packed past what it can show.
  const t0 = Date.now()
  while (Date.now() - t0 < 90_000) {
    const go = page.locator('.intro:not([hidden]) .intro-go')
    if (await go.isVisible().catch(() => false)) await go.click().catch(() => {})
    const st = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.convoy())
    if (st && st.column > 20 && st.drawn > 10) break
    await page.waitForTimeout(400)
  }
  const { st, cells } = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const lv = h.game().level
    const cells: string[] = []
    for (const path of [lv.path, lv.path2].filter(Boolean) as number[][][])
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = path[i - 1]!
        const [bx, by] = path[i]!
        const n = Math.abs(bx! - ax!) + Math.abs(by! - ay!)
        for (let k = 0; k <= n; k++) cells.push(`${ax! + Math.sign(bx! - ax!) * k},${ay! + Math.sign(by! - ay!) * k}`)
      }
    return { st: h.convoy()!, cells }
  })
  expect(st.column).toBeGreaterThan(20)
  expect(st.places.length).toBeGreaterThan(10)
  const lane = new Set(cells)
  for (const p of st.places) expect(lane.has(`${Math.floor(p.x)},${Math.floor(p.y)}`), `${p.x.toFixed(2)},${p.y.toFixed(2)} on the lane`).toBe(true)
  // Each column shows its head (or none behind the gate) and its chip (unless a swarm badge rides it) the rest.
  for (const c of st.cols) {
    if (c.badged) continue
    expect(c.chip).toBe(c.count - (c.at === null ? 0 : 1))
  }
  await page.screenshot({ path: `e2e/screenshots/h684/l34-${hasTouch ? 'P' : 'D'}.png` })
})
