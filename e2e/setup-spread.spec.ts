import { test, expect } from '@playwright/test'

// Plan item 8: on a desktop, Setup is a market-table spread rather than a 450 px form column. At 1440x900 it
// uses at least 75% of the width, and every producer card and Start are on screen without scrolling.
test('desktop Setup spreads across the table', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the spread is the desktop layout; phones keep the column')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  const vw = page.viewportSize()!
  const setup = (await page.locator('main.setup').boundingBox())!
  expect(setup.width).toBeGreaterThanOrEqual(vw.width * 0.75)
  const boxes = [...(await page.locator('.producer-card').all()), page.getByRole('button', { name: 'Start' })]
  expect(boxes.length).toBe(5)
  for (const el of boxes) {
    const b = (await el.boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.y + b.height).toBeLessThanOrEqual(vw.height)
  }
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
})
