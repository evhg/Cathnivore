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

// Plan item 47: no keepsake is cut off at rest. A phone shows one whole page with dots; a wide screen both.
test('the keepsakes are whole: one page at a time with dots on a phone, side by side when there is room', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  await expect(page.locator('#dlg-win')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#win-card')).toBeVisible()
  await page.waitForTimeout(700)
  const m = await page.evaluate(() => {
    const row = document.querySelector('#win-keepsakes')!.getBoundingClientRect()
    const kids = [...document.querySelectorAll('#win-keepsakes .win-card, #win-keepsakes .bea')].map((e) => e.getBoundingClientRect())
    const whole = kids.map((r) => r.left >= row.left - 1 && r.right <= row.right + 1 && r.right <= innerWidth && r.left >= 0)
    const partly = kids.map((r) => r.right > row.left + 1 && r.left < row.right - 1)
    return { whole, partly, pager: !document.querySelector<HTMLElement>('#win-pager')!.hidden }
  })
  // Every keepsake in view is whole: none half in, half out.
  for (let i = 0; i < m.whole.length; i++) if (m.partly[i]) expect(m.whole[i], `keepsake ${i}`).toBe(true)
  if (m.pager) expect(m.partly.filter(Boolean).length).toBe(1)
  else expect(m.whole.every(Boolean)).toBe(true)
})
