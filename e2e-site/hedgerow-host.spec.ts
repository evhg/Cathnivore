import { expect, test } from '@playwright/test'

// Plan item 250: Cath's line on the field has her portrait as its host (96 px at D, 64 on a small field), and its face
// follows the field: a clean round delights her, a leaky one worries her.
type HG = { game(): unknown; rosette(round: number, reward: number, clean: boolean): unknown }

for (const [w, h, min] of [[1440, 900, 96], [844, 390, 64]] as const)
  test(`her line has her portrait, and it reacts to the round (${w}x${h})`, async ({ page, hasTouch }) => {
    test.skip(hasTouch && w > 900, 'desktop size on the desktop project only')
    test.setTimeout(90_000)
    await page.setViewportSize({ width: w, height: h })
    const level = 21
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    const say = page.locator('#cath-say')
    await expect(say).toBeVisible({ timeout: 20_000 })
    const face = say.locator('.cath-say-face')
    await expect(face).toBeVisible()
    expect((await face.boundingBox())!.width).toBeGreaterThanOrEqual(min)
    await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.rosette(1, 10, true))
    await expect(say).toHaveAttribute('data-expr', 'delighted', { timeout: 2000 })
    await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.rosette(2, 10, false))
    await expect(say).toHaveAttribute('data-expr', 'worried', { timeout: 2000 })
  })
