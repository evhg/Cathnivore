import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 118 (slice 1): on a desktop Cath stands at the table's left edge in play, half-length, 260 px or more,
// clear of every region hex and of the action column, her face following the game's events. Slice 2: her line in
// a bubble over her head, so the header no longer carries a second Cath.
test('Cath stands at the table during play at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only; the phone keeps the strip portrait')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    const cath = page.locator('.table-cath')
    await expect(cath).toBeVisible()
    const box = (await cath.boundingBox())!
    expect((await cath.locator('.table-cath-figure').boundingBox())!.height, `${width}x${height}`).toBeGreaterThanOrEqual(260)
    // Her line is a bubble over her head (15 px or more), not a second Cath in the header.
    const line = cath.locator('.table-cath-line')
    await expect(line).not.toBeEmpty()
    expect(await line.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(15)
    await expect(page.locator('.table-head .cath-companion')).toHaveCount(0)
    const overlap = (a: { x: number; y: number; width: number; height: number }) =>
      a.x < box.x + box.width && box.x < a.x + a.width && a.y < box.y + box.height && box.y < a.y + a.height
    for (const hex of await page.locator('.region-hex').all()) {
      const h = (await hex.locator('polygon').first().boundingBox())!
      expect(overlap(h), `${width}x${height} ${await hex.getAttribute('data-region')}`).toBe(false)
    }
    expect(overlap((await page.locator('.actions').first().boundingBox())!)).toBe(false)
    // Inside the table, and no page scroll added.
    const map = (await page.locator('.map-wrap').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(map.x)
    expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height + 1)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
    await expect(cath).toHaveAttribute('data-expression', 'smirk')
  }
})

test('her expression follows the round at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const cath = page.locator('.table-cath')
  await expect(cath).toHaveAttribute('data-expression', 'smirk')
  // Spend the turn; the round's end brings Hollowell's moves and her reaction to them.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /^Sell 1 Produce/ }).click()
    await page.locator('.actions').waitFor()
  }
  await expect(cath).not.toHaveAttribute('data-expression', 'smirk', { timeout: 30_000 })
})
