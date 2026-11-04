import { expect, test } from '@playwright/test'

// Plan item 114: the 2D Cath stands a head above her towers (48 px or more at D, 36 on a phone) and has the 3D
// figure's moods: a cheer on a cleared wave, a worried hand at a leak, a stoop to plant a tower.
type HG = {
  game(): { events: unknown[]; level: { cols: number; rows: number } } | null
  heroPx(): { h: number; w: number } | null
  heroMood(): string | null
  silhouette(k: string, cell: number): { w: number; mask: number[] }
  cellCenter(c: number, r: number): { x: number } | null
  place(g: unknown, k: string, c: number, r: number): { ok: boolean }
}

test('the 2D Cath is a head above her towers and reacts', async ({ page, hasTouch }) => {
  test.setTimeout(90_000)
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  const m = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const cell = Math.round(hg.cellCenter(1, 0)!.x - hg.cellCenter(0, 0)!.x)
    const s = hg.silhouette('scarecrow', cell)
    let y0 = 1e9
    let y1 = -1
    s.mask.forEach((v, i) => {
      if (v) {
        const y = (i / s.w) | 0
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
    })
    return { hero: hg.heroPx()!, tower: y1 - y0 + 1 }
  })
  expect(m.hero.h).toBeGreaterThanOrEqual(hasTouch ? 36 : 48)
  expect(m.hero.h).toBeGreaterThan(m.tower * 1.2)
  const mood = () => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.heroMood())
  await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.events.push({ type: 'cleared', wave: 1, reward: 0 }))
  await expect.poll(mood, { timeout: 5_000, intervals: [50] }).toBe('cheer')
  await expect.poll(mood, { timeout: 5_000 }).toBe('rest')
  await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.events.push({ type: 'leak', x: 1, y: 1, lost: 1 }))
  await expect.poll(mood, { timeout: 5_000, intervals: [50] }).toBe('worried')
  await expect.poll(mood, { timeout: 5_000 }).toBe('rest')
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const g = hg.game()!
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (hg.place(g, 'hedgerow', c, r).ok) return
  })
  await expect.poll(mood, { timeout: 5_000, intervals: [50] }).toBe('plant')
})

type Box = { x: number; y: number; w: number; h: number }
type HG2 = HG & { cathBox(): Box | null; plotBoxes(): Box[]; rosette(r: number, m: number, c: boolean): void; game(): { towers: Array<{ col: number; row: number }> } & ReturnType<HG['game']> }
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

test('the 2D Cath covers no plot, and a clean-sweep rosette keeps off her', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG2 }).hedgerow?.game(), null, { timeout: 60_000 })
  const m = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG2 }).hedgerow
    return { cath: hg.cathBox()!, plots: hg.plotBoxes() }
  })
  expect(m.cath.h).toBeGreaterThan(0)
  // Her box may graze a neighbour's edge; it must not stand over a plot (more than a tenth of one covered).
  for (const p of m.plots) expect(overlap(m.cath, p), JSON.stringify({ cath: m.cath, plot: p })).toBeLessThan(p.w * p.h * 0.1)
  await page.evaluate(() => (window as unknown as { hedgerow: HG2 }).hedgerow.rosette(3, 40, true))
  const rosette = page.locator('.round-rosette.clean')
  await expect(rosette).toBeVisible()
  await page.waitForTimeout(700)
  const r = (await rosette.boundingBox())!
  expect(overlap(m.cath, { x: r.x, y: r.y, w: r.width, h: r.height })).toBe(0)
})
