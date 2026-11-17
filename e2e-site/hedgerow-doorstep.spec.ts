import { expect, test } from '@playwright/test'

// Plan item 480: every leak leaves a parcel on the farmhouse step: `#stage[data-doorstep]` counts them, and the sale
// board goes up only under a quarter of the Goodwill.
type G = { wave: number; phase: string; goodwill: number; maxGoodwill: number; towers: unknown[]; level: { waves: unknown[] } }
type HG = { game(): G; sendWave(g: unknown, force?: boolean): void }
test('leaks pile parcels on the farmhouse step; the sale board goes up under a quarter', async ({ page }) => {
  test.setTimeout(180_000)
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 3: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  const stage = page.locator('#stage')
  await expect(stage).toHaveAttribute('data-doorstep', '0')
  expect(await stage.getAttribute('data-saleboard')).toBeNull()
  // an undefended round: everything walks through
  const goodwill0 = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const g = hg.game()
    g.goodwill = g.maxGoodwill = 1000 // the farm can't fall while we count
    hg.sendWave(g, true)
    return g.goodwill
  })
  await expect.poll(() => stage.getAttribute('data-doorstep').then(Number), { timeout: 120_000 }).toBeGreaterThan(0)
  const lost = await page.evaluate((g0) => g0 - (window as unknown as { hedgerow: HG }).hedgerow.game().goodwill, goodwill0)
  expect(lost).toBeGreaterThan(0)
  expect(await stage.getAttribute('data-saleboard')).toBeNull()
  // under a quarter: the board goes up
  await page.evaluate(() => {
    const g = (window as unknown as { hedgerow: HG }).hedgerow.game()
    g.goodwill = Math.floor(g.maxGoodwill * 0.2)
  })
  await expect(stage).toHaveAttribute('data-saleboard', '')
})

// Plan item 480: a clean round's return sends two neighbours up the lane with a handcart; the win sweeps the step;
// neither plays under reduced motion (the parcel simply goes).
type HA = { game(): G; leakDoorstep(n: number): number; cartDoorstep(): number; doorstepAnims(): { carts: number; sweep: boolean } | null }
for (const reduce of [false, true]) {
  test(`the neighbours cart a parcel back and the win sweeps the step${reduce ? ' (reduced motion: no animation)' : ''}`, async ({ page }) => {
    test.setTimeout(120_000)
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 3: true }, tips: t })), [stars, tips])
    await page.goto('/hedgerow/?sandbox=1&2d&level=3')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HA }).hedgerow?.game(), null, { timeout: 60_000 })
    const stage = page.locator('#stage')
    await page.evaluate(() => (window as unknown as { hedgerow: HA }).hedgerow.leakDoorstep(4))
    await expect(stage).toHaveAttribute('data-doorstep', '4')
    await page.evaluate(() => (window as unknown as { hedgerow: HA }).hedgerow.cartDoorstep())
    await expect(stage).toHaveAttribute('data-doorstep', '3')
    const anims = () => page.evaluate(() => (window as unknown as { hedgerow: HA }).hedgerow.doorstepAnims())
    if (reduce) expect((await anims())!.carts).toBe(0)
    else await expect.poll(async () => (await anims())!.carts, { timeout: 5_000 }).toBe(1)
    await page.evaluate(() => { (window as unknown as { hedgerow: HA }).hedgerow.game().phase = 'won' })
    await expect(stage).toHaveAttribute('data-doorstep', '0')
    if (reduce) expect((await anims())!.sweep).toBe(false)
    else await expect.poll(async () => (await anims())!.sweep, { timeout: 5_000 }).toBe(true)
  })
}
