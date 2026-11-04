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

// On a phone the Setup has no spare height (plan items 75 and 80), so the board stands beside its name: 44 px
// tall or more (it was 28 px over the name), in the same no-scroll screen.
test('the phone maps are boards beside their names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  const minis = page.locator('.layout-tile .board-mini')
  await expect(minis).toHaveCount(3)
  for (const box of await minis.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  for (const tile of await page.locator('.layout-tile').all()) {
    const mini = (await tile.locator('.board-mini').boundingBox())!
    const name = (await tile.locator('.layout-name').boundingBox())!
    expect(name.x).toBeGreaterThanOrEqual(mini.x + mini.width - 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
})
