import { expect, test, type Page } from '@playwright/test'

// Plan item 676: a staged battle reads as a battle in a still. Eight of the level's towers on the plots covering the
// most lane, armed for the round (`arm`), the round sent; then in 2D three or more towers show their muzzle puff with
// a coin in the air to the purse, and in 3D (the sim run on unseen with `warp`, headless WebGL drawing a few frames a
// second) twelve or more vehicles stand on the lane while towers puff.
type FX = { attackers: number; coinsInAir: number; vehicles: number; shots: number; cues: number; trails: number }
type HG = {
  game(): {
    level: { path?: number[][]; path2?: number[][]; rows: number; cols: number; towers: string[] }
    enemies: { hp: number }[]
  }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  arm(g: unknown): number
  sendWave(g: unknown, forced?: boolean): { ok: boolean }
  warp(g: unknown, secs: number): number
  fx(): FX
}
const hg = (p: Page) => p.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fx())

async function stage(page: Page, mode: '2d' | '3d'): Promise<void> {
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 27: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto(`/hedgerow/?sandbox=1&level=27${mode === '2d' ? '&2d' : ''}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const path = [...(g.level.path ?? []), ...(g.level.path2 ?? [])]
    const near = (c: number, r: number) => Math.min(...path.map(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r)))
    const cover = (c: number, r: number) => path.filter(([pc, pr]) => Math.hypot(pc! - c, pr! - r) <= 2.2).length
    const spots: [number, number, number][] = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
    spots.sort((a, b) => Number(a[0] > 1) - Number(b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
    let n = 0
    for (const [, c, r] of spots) {
      if (n >= 8) break
      if (h.place(g, g.level.towers[n % g.level.towers.length]!, c, r).ok) n++
    }
    h.arm(g)
    h.sendWave(g, true)
  })
  // A new vehicle's field-guide page holds the round until it's dismissed.
  const closeGuide = () =>
    page.evaluate(() => {
      const go = document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')
      go?.click()
      return !!go
    })
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(700)
    if (await closeGuide()) continue
    if ((await hg(page)).vehicles >= 3) break
  }
}

test('the staged 2D battle shows three towers firing and a coin in the air', async ({ page }) => {
  test.setTimeout(120_000)
  await stage(page, '2d')
  await expect
    .poll(
      async () => {
        await page.evaluate(() => document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click())
        const f = await hg(page)
        return f.cues >= 3 && f.coinsInAir >= 1 && f.trails >= 1
      },
      { timeout: 40_000, intervals: [100] },
    )
    .toBe(true)
})

test('the staged 3D battle has twelve vehicles on the lane and towers puffing', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough: headless WebGL is slow')
  test.setTimeout(180_000)
  await stage(page, '3d')
  const left = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    return h.warp(h.game(), 7)
  })
  expect(left).toBeGreaterThanOrEqual(12)
  await expect
    .poll(
      async () => {
        await page.evaluate(() => document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click())
        const f = await hg(page)
        return f.vehicles >= 12 && f.cues >= 2 && f.trails >= 3
      },
      { timeout: 90_000, intervals: [250] },
    )
    .toBe(true)
})
