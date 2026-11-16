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

// Plan item 461: on a phone the map step is one large board between two arrows (it was three 44 px boards beside
// their names); the three names under it are the radios, each one line or two, and the page never scrolls.
test('the phone map is one large board, the names under it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('.setup-dot').nth(1).click()
  const board = page.locator('.map-stage .board-mini')
  await expect(board).toHaveCount(1)
  const b = (await board.boundingBox())!
  expect(b.width).toBeGreaterThanOrEqual(200)
  expect(b.height).toBeGreaterThanOrEqual(160)
  for (const tile of await page.locator('.layout-tile').all()) {
    const name = (await tile.locator('.layout-name').boundingBox())!
    const lh = await tile.locator('.layout-name').evaluate((e) => parseFloat(getComputedStyle(e).lineHeight))
    expect(name.height).toBeLessThanOrEqual(lh * 2 + 1)
    expect(name.y).toBeGreaterThanOrEqual(b.y + b.height)
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
})
