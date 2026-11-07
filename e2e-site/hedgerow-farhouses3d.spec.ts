import { expect, test } from '@playwright/test'

// Plan item 201: the far row's houses stand wholly in the 3D frame or out of it; a wide frame sliced l21's through
// their roofs along the top edge.
type Rect = { x: number; y: number; w: number; h: number }
type W = { hedgerow?: { game: () => unknown; camSettled?: () => boolean; farHouses3d?: () => Rect[] } }

for (const level of [21, 5, 34]) {
  test(`level ${level}: no far house is cut by the frame's top`, async ({ page }, info) => {
    test.setTimeout(150_000)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => {
      const h = (window as unknown as W).hedgerow
      return !!h?.game() && !!h.camSettled?.() && (h.farHouses3d?.().length ?? 0) > 0
    }, null, { timeout: 120_000 })
    // Settled on the frame after the camera's; give it a couple of frames.
    await page.waitForTimeout(1500)
    const rects = await page.evaluate(() => (window as unknown as W).hedgerow!.farHouses3d!())
    const cut = rects.filter((r) => r.y < 1 && r.y + r.h > 1)
    expect(cut, JSON.stringify(rects.map((r) => [Math.round(r.y), Math.round(r.y + r.h)]))).toEqual([])
    // An upright phone has room above the field, so its houses come forward into view; a wide frame's band is too
    // short for a whole house, so they step back out of it.
    if (info.project.name === 'site-phone') expect(rects.filter((r) => r.y >= 1).length).toBeGreaterThan(0)
  })
}

// Plan item 228: Saltmarsh's moored boats likewise stand wholly in the frame or out of it (a wide frame's left edge
// sliced two of l21's into red slabs).
test('level 21: no moored boat is cut by the frame', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => {
    const h = (window as unknown as W & { hedgerow?: { moored3d?: () => Rect[] } }).hedgerow
    return !!h?.game() && !!h.camSettled?.() && (h.moored3d?.().length ?? 0) > 0
  }, null, { timeout: 120_000 })
  await page.waitForTimeout(1500)
  const rects = await page.evaluate(() => (window as unknown as { hedgerow: { moored3d: () => Rect[] } }).hedgerow.moored3d())
  const cut = rects.filter((r) => (r.x < 1 && r.x + r.w > 1) || (r.y < 1 && r.y + r.h > 1))
  expect(cut, JSON.stringify(rects.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w)]))).toEqual([])
})

// Plan item 224: the Ballot's advert boards on the side verges stand wholly in the frame or aren't shown (the left
// edge sliced 'SCAN & SAVE' at 1440x900).
test('level 75: no advert board is cut by the frame', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=75')
  await page.waitForFunction(() => {
    const h = (window as unknown as W & { hedgerow?: { adverts3d?: () => Rect[] } }).hedgerow
    return !!h?.game() && !!h.camSettled?.()
  }, null, { timeout: 120_000 })
  await page.waitForTimeout(1500)
  const rects = await page.evaluate(() => (window as unknown as { hedgerow: { adverts3d: () => Rect[] } }).hedgerow.adverts3d())
  const box = (await page.locator('canvas').first().boundingBox())!
  const cut = rects.filter((r) => r.x < 1 || r.y < 1 || r.x + r.w > box.width - 1 || r.y + r.h > box.height - 1)
  expect(cut, JSON.stringify(rects.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w)]))).toEqual([])
  // a wide frame keeps at least one board in view
  if (box.width > box.height) expect(rects.length).toBeGreaterThan(0)
})
