import { test, expect } from '@playwright/test'
import { LAYOUTS, type LayoutId } from '../src/content/layouts'

// Plan item 101: each map on the Setup is a miniature of its real board, drawn from the layout's data, 120 px
// wide or more on a desktop, and the desktop Setup still fits without scrolling.

for (const [w, h] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`the maps are boards you can see at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    const minis = page.locator('.layout-tile .board-mini')
    await expect(minis).toHaveCount(3)
    for (const id of Object.keys(LAYOUTS) as LayoutId[]) {
      const mini = page.locator(`.layout-tile .board-mini[data-layout="${id}"]`)
      expect(Number(await mini.getAttribute('data-regions'))).toBe(Object.keys(LAYOUTS[id].hexes).length)
      await expect(mini.locator('[data-region]')).toHaveCount(Object.keys(LAYOUTS[id].hexes).length)
      expect((await mini.boundingBox())!.width).toBeGreaterThanOrEqual(120)
    }
    // The Delta shows its river and its two bridges.
    await expect(page.locator('.board-mini[data-layout="delta"] .board-mini-river')).toHaveCount(LAYOUTS.delta.channels!.length)
    await expect(page.locator('.board-mini[data-layout="delta"] .board-mini-bridge')).toHaveCount(2)
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    expect(scroll).toBeLessThanOrEqual(0)
  })
}
