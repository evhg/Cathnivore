import { expect, test } from '@playwright/test'

type HG = { game(): { wave: number; phase: string; level: { waves: unknown[] } }; sendWave(g: unknown, force?: boolean): void }

// Plan item 479 in 3D: through the last round the shutters stay up and the rep stands at the open door, stepping
// down from the roof (his overlay at the depot's foot, `--from-y` up to the roof); the win holds the camera on the
// last knockout. (Headless WebGL draws a frame or two a second, so the camera's lean itself isn't timed here.)
type H3 = HG & { depotShutter3d(): number | null; knockoutView(): { ease: number; held: boolean; until: number; x: number; z: number } | null }
test('3D: the showdown opens the depot, the rep comes down to the door, the win holds the camera', async ({ page }) => {
  test.setTimeout(240_000)
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 21: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&showdown&level=21')
  await page.waitForFunction(() => (window as unknown as { hedgerow?: H3 }).hedgerow?.depotShutter3d() != null, null, { timeout: 120_000 })
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: H3 }).hedgerow
    const g = hg.game() as { wave: number; phase: string; enemies: unknown[]; level: { waves: unknown[] } }
    g.enemies.length = 0
    g.wave = g.level.waves.length - 1
    g.phase = 'build'
    hg.sendWave(g, true)
  })
  await expect(page.locator('#stage')).toHaveAttribute('data-showdown', '', { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: H3 }).hedgerow.depotShutter3d()), { timeout: 60_000 }).toBeGreaterThan(0.9)
  const reps = page.locator('.depot-3d')
  if (await reps.count()) {
    await expect(page.locator('.depot-3d:not([data-showdown])')).toHaveCount(0, { timeout: 30_000 })
    const fromY = await reps.first().evaluate((e) => parseFloat((e as HTMLElement).style.getPropertyValue('--from-y')))
    expect(fromY, 'he steps down from the roof').toBeLessThan(0)
  }
  await page.evaluate(() => { (window as unknown as { hedgerow: H3 }).hedgerow.game().phase = 'won' })
  await expect(page.locator('#stage')).toHaveAttribute('data-knockout', '3d', { timeout: 30_000 })
  // the camera was given the hold (its window ends 700 ms after the win; headless frames can land after it)
  const view = await page.evaluate(() => ({ v: (window as unknown as { hedgerow: H3 }).hedgerow.knockoutView(), now: performance.now() }))
  expect(view.v!.until).toBeGreaterThan(0)
  expect(view.v!.until).toBeLessThan(view.now + 800)
  expect(Number.isFinite(view.v!.x) && Number.isFinite(view.v!.z)).toBe(true)
  // and lets go for the harvest (its timing is checked in 2D above; a slow 3D frame can outlast the harvest's own life)
  await expect(page.locator('#stage')).not.toHaveAttribute('data-knockout', /./, { timeout: 30_000 })
})
