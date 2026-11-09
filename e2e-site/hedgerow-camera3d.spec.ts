import { expect, test } from '@playwright/test'

// Plan item 191: on Go the 3D camera dollies from the depot down the lane, then holds the play view again (within
// 1% of where it was); under reduced motion it never moves.
type Cam = { x: number; y: number; z: number; moving: boolean }
type W = { hedgerow?: { game: () => unknown; sendWave: (g: unknown) => void; cam3d?: () => Cam | null } }
const cam = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as W).hedgerow!.cam3d!()!)
const dist = (a: Cam, b: Cam) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

async function open(page: import('@playwright/test').Page) {
  await page.goto('/hedgerow/?sandbox=1&level=3')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.cam3d?.(), null, { timeout: 90_000 })
  await page.waitForTimeout(1500)
}

test('Go dollies from the depot, then settles back on the play view', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 600, 'phones get cuts, not moves')
  test.setTimeout(150_000)
  await open(page)
  const base = await cam(page)
  await page.evaluate(() => { const h = (window as unknown as W).hedgerow!; h.sendWave(h.game()) })
  await expect.poll(async () => (await cam(page)).moving, { timeout: 10_000 }).toBe(true)
  const mid = await cam(page)
  expect(dist(mid, base)).toBeGreaterThan(0.05 * Math.hypot(base.x, base.y, base.z) * 0.1)
  // The round can follow the dolly with a short shot of its own (a pause between them reads as "not moving"), so
  // wait until the camera is at rest back on the play view.
  await expect
    .poll(async () => {
      const c = await cam(page)
      return c.moving ? 1 : dist(c, base) / Math.hypot(base.x, base.y, base.z)
    }, { timeout: 30_000 })
    .toBeLessThanOrEqual(0.01)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the camera cuts: still at 0 and 200 ms after Go', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    await page.evaluate(() => { const h = (window as unknown as W).hedgerow!; h.sendWave(h.game()) })
    // The round's panel can resize the canvas once as it starts (a refit is a cut); then nothing moves.
    expect((await cam(page)).moving).toBe(false)
    await page.waitForTimeout(1500)
    const a = await cam(page)
    await page.waitForTimeout(200)
    const b = await cam(page)
    expect(a.moving || b.moving).toBe(false)
    expect(dist(a, b)).toBeLessThanOrEqual(0.001 * Math.hypot(a.x, a.y, a.z))
  })
})
