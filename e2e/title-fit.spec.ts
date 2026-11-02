import { test, expect } from '@playwright/test'

// Plan item 33: at 390x844 the title's footer was clipped (it ran under the fold). The whole title, footer
// links included, fits the screen at P and D.
test('the title and its footer fit the screen', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('.title-footer')
  await expect(footer).toBeVisible()
  const vh = page.viewportSize()!.height
  const box = (await footer.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(vh + 1)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
})
