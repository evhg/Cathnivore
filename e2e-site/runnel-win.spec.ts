import { test, expect } from '@playwright/test'

// Plan item 37: on a 390x844 phone the win card shows its headline, its primary button and Cath's whole
// medallion without scrolling; the share card and Bea's postcard swipe sideways below. `?shotwin` (the
// screenshot hook) never writes a result.
test('the win card fits its headline, button and medallion in view, and the shot hook saves nothing', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  const dlg = page.locator('#dlg-win')
  await expect(dlg).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(700) // the sheet's slide-in
  const vh = page.viewportSize()!.height
  for (const sel of ['#win-title', '#btn-share', '#win-cath']) {
    const box = (await page.locator(sel).boundingBox())!
    expect(box.y, `${sel} top`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${sel} bottom`).toBeLessThanOrEqual(vh)
  }
  // The keepsakes are one sideways row, below the buttons.
  const share = (await page.locator('#btn-share').boundingBox())!
  const bea = (await page.locator('#win-bea').boundingBox())!
  expect(bea.y).toBeGreaterThan(share.y)
  expect(await page.locator('#win-keepsakes').evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
  expect(await page.evaluate(() => localStorage.getItem('runnel:v1'))).toBeNull()
})
