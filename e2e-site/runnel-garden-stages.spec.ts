import { expect, test } from '@playwright/test'

// Plan item 197: Bea's garden grows with the share of fields watered (0 under a third, 1, 2 from two thirds, 3 at the
// solve), big enough to read on a phone.
test('the garden grows through the level', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(600)
  const garden = page.locator('.bea-garden')
  const expected = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('#board .tiles > g.cell.field')]
    const wet = fields.filter((f) => f.classList.contains('wet')).length
    const share = fields.length ? wet / fields.length : 0
    return String(share >= 2 / 3 ? 2 : share >= 1 / 3 ? 1 : 0)
  })
  await expect(garden).toHaveAttribute('data-garden-stage', expected)
  const box = (await garden.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(120)
  expect(box.height).toBeGreaterThanOrEqual(56)
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(garden).toHaveAttribute('data-garden-stage', '3')
  await expect.poll(() => page.locator('.gg-scarecrow').evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 3000 }).toBeGreaterThan(0.9)
})
