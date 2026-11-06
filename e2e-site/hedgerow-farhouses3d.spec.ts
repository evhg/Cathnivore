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
