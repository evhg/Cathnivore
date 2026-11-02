import { test, expect } from '@playwright/test'

// Plan item 15: the map is picked on Setup. Each layout starts a game with its own hexes on the board: the
// ring's 7, the Long Coast's 10, the Delta's 7 in a river shape. (SHOTS=1 saves each board to e2e/screenshots.)
const LAYOUTS = [
  { name: 'The Ring', count: 7, id: 'ring' },
  { name: 'The Long Coast', count: 10, id: 'coast' },
  { name: 'The Delta', count: 7, id: 'delta' },
]

for (const l of LAYOUTS)
  test(`Setup starts a game on ${l.name}`, async ({ page }, testInfo) => {
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.locator('.layout-tile', { hasText: l.name }).click()
    await expect(page.getByRole('radio', { name: new RegExp(l.name) })).toBeChecked()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.game')).toBeVisible()
    await expect(page.locator('svg.map .region-sign')).toHaveCount(l.count)
    // Every hex is inside the map's box (the layout is scaled to fit the square).
    const map = (await page.locator('svg.map').boundingBox())!
    for (const sign of await page.locator('svg.map .region-sign').all()) {
      const b = (await sign.boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(map.x - 1)
      expect(b.x + b.width).toBeLessThanOrEqual(map.x + map.width + 1)
    }
    if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/layout-${l.id}-${testInfo.project.name}.png` })
  })
