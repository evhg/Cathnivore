import { test, expect } from '@playwright/test'

// Plan item 426: the campaign map is a drawn atlas sheet on the table. A 24 x 24 grid sampled over the map's box finds
// no one flat colour (channels within 6) on more than 15% of it, and at desktop sizes Cath stands beside the sheet,
// her box clear of its sea.
test('the campaign map is an atlas sheet, not a flat sea box', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map [data-region]')).toHaveCount(7)
  await expect(page.locator('.cmp-sheet')).toBeVisible()
  await expect(page.locator('.cmp-cartouche-title')).toHaveText('Marrow')
  await page.waitForTimeout(600)
  const box = (await page.locator('.cmp-map-svg').boundingBox())!
  const shot = (await page.screenshot()).toString('base64')
  const flat = await page.evaluate(
    async ({ shot, box }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${shot}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const k = img.width / innerWidth
      const counts = new Map<string, number>()
      const N = 24
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const x = Math.round((box.x + ((i + 0.5) / N) * box.width) * k)
          const y = Math.round((box.y + ((j + 0.5) / N) * box.height) * k)
          const d = g.getImageData(x, y, 1, 1).data
          const key = `${Math.round(d[0]! / 6)},${Math.round(d[1]! / 6)},${Math.round(d[2]! / 6)}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      return Math.max(...counts.values()) / (N * N)
    },
    { shot, box },
  )
  expect(flat, 'share of the map in one flat colour').toBeLessThanOrEqual(0.15)
  if ((page.viewportSize()?.width ?? 0) >= 1100) {
    const sea = (await page.locator('.cmp-sea').boundingBox())!
    const cath = (await page.locator('.cmp-map-host .cmp-header-cath').boundingBox())!
    // Plan item 659: she stands at the sheet's lower-right corner, pointing in: her middle past the sea's right edge
    // and her boots under its foot, so she stands on the table, not out on the water.
    expect(cath.x + cath.width / 2, 'Cath stands on the sheet\'s sea').toBeGreaterThanOrEqual(sea.x + sea.width - 10)
    expect(cath.y + cath.height).toBeGreaterThanOrEqual(sea.y + sea.height)
  }
})
