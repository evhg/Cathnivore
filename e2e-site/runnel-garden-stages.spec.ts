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
  // (plan item 661: where the board reaches its corner it keeps to the clear strip beside the tiles, 72 px+)
  const fit = await page.evaluate(() => (() => {
    // plan item 661: a board that reaches the garden's corner leaves it the strip beside the tiles (data-tight)
    const g = document.querySelector('.bea-garden')!, r = g.getBoundingClientRect()
    let hits = 0
    for (let y = r.top + 2; y < r.bottom - 2; y += 4) for (let x = r.left + 2; x < r.right - 2; x += 4) if (document.elementsFromPoint(x, y).some((e) => e.matches('#board polygon.tile'))) hits++
    return { tight: g.hasAttribute('data-tight'), hits }
  })())
  expect(fit.hits).toBe(0)
  expect(box.width).toBeGreaterThanOrEqual(fit.tight ? 72 : 120)
  expect(box.height).toBeGreaterThanOrEqual(56)
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(garden).toHaveAttribute('data-garden-stage', '3')
  await expect.poll(() => page.locator('.gg-scarecrow').evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 3000 }).toBeGreaterThan(0.9)
})
