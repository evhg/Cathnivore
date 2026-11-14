import { expect, test } from '@playwright/test'

// Plan item 388: the margins' props stand clear of the board's frame (punts and a beach hut were cut by it at the
// screen's edge): every placed piece's box lies inside the field canvas.
type Piece = { kind: string; x: number; y: number; w: number; h: number }
type Hg = { game(): unknown; margin2d(): { set: string; pieces: Piece[] } | null }

for (const level of [21, 34, 45])
  test(`level ${level}: every margin piece inside the board`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate((id) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [id]: true } })), level)
    await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.waitForTimeout(800)
    const m = await page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.margin2d())
    const canvas = (await page.locator('canvas').first().boundingBox())!
    for (const p of m?.pieces ?? []) {
      const where = `${p.kind} at ${Math.round(p.x)},${Math.round(p.y)}`
      expect(p.x - p.w / 2, where).toBeGreaterThanOrEqual(0)
      expect(p.y - p.h / 2, where).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w / 2, where).toBeLessThanOrEqual(canvas.width)
      expect(p.y + p.h / 2, where).toBeLessThanOrEqual(canvas.height)
    }
  })
