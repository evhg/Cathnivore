import { test, expect } from '@playwright/test'

// Plan item 654: Candor's Doubt is drawn as its leaflet, names itself, and opens a one-line card (what it is, what it
// costs, which action clears it) on a tap and on keyboard focus.
test('a Doubt on the board says what it is', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const piece = page.locator('.map-wrap svg.map [data-piece="d"][data-peekable]').first()
  await expect(piece).toBeAttached({ timeout: 20_000 })
  await expect(piece).toHaveAttribute('data-silhouette', 'leaflet')
  await expect(piece).toHaveAttribute('role', 'button')
  await expect(piece).toHaveAttribute('aria-label', /Doubt in .+: Candor's leaflet.*Rebut/)
  await page.waitForTimeout(1500)

  // a tap (or click) pins the card; it names Rebut and Goodwill, and sits inside the viewport
  await piece.click()
  const card = page.locator('.piece-peek')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Doubt')
  await expect(card).toContainText('Rebut')
  await expect(card).toContainText('Goodwill')
  const vw = page.viewportSize()!.width
  const box = (await card.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vw)
  await expect(piece).toHaveAttribute('aria-expanded', 'true')
  // the tap opened the card, not the region's close-up
  await expect(page.locator('.region-closeup, [data-region-closeup]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)

  // keyboard focus opens it too (the click left the piece focused, so move focus off it first)
  await piece.blur()
  await piece.focus()
  await expect(card).toBeVisible()
  await piece.blur()
  await expect(card).toHaveCount(0)
})
