import { expect, test } from '@playwright/test'

// Plan item 458: on an upright phone Cath is her half figure at the board's foot-left (she was a 52 px face in a tile):
// 150 px tall, rising over the board's frame but never over a tile, pointing at the board in the lesson; the page
// still doesn't scroll.
for (const q of ['?lesson', '?nohelp'] as const) {
  test(`phone dock Cath at ${q}: a half figure, 150 px, clear of the tiles`, async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 600, 'the upright phone dock')
    await page.goto(`/runnel/${q}`)
    const face = page.locator('#host-face')
    await expect(face).toHaveAttribute('data-framing', 'half')
    await page.waitForTimeout(1200)
    const m = await page.evaluate(() => {
      const f = document.getElementById('host-face')!.getBoundingClientRect()
      const stage = document.querySelector('.stage')!.getBoundingClientRect()
      // Her body is the box's middle 70% (her head narrower still); no tile outline point may fall inside it.
      const body = { l: f.left + f.width * 0.15, r: f.right - f.width * 0.15, t: f.top, b: f.bottom }
      let onTile = 0
      for (const poly of document.querySelectorAll<SVGPolygonElement>('#board polygon.tile')) {
        const ctm = poly.getScreenCTM()!
        const pts = [...poly.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(ctm))
        const xs = pts.map((p) => p.x)
        const ys = pts.map((p) => p.y)
        const box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }
        if (box.l < body.r && body.l < box.r && box.t < body.b && body.t < box.b) onTile++
      }
      return { h: f.height, over: stage.bottom - f.top, onTile, scroll: document.scrollingElement!.scrollHeight - innerHeight }
    })
    expect(m.h).toBeGreaterThanOrEqual(150)
    expect(m.over).toBeGreaterThan(20)
    expect(m.onTile).toBe(0)
    expect(m.scroll).toBeLessThanOrEqual(0)
    if (q === '?lesson') await expect(face).toHaveAttribute('data-pose', 'point')
  })
}

// At D the dock keeps its face portrait (the valley figure is the full-length Cath there).
test('desktop host keeps the face portrait', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1100, 'the desktop host')
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#host-face')).toHaveAttribute('data-framing', 'face')
})
