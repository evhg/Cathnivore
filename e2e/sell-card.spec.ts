import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 384: Sell is one card with a 1-2-3 count on its face. Picking a count changes what the card plays
// (its accessible name and its barrow), arrow keys step the count, and counts the farm can't afford are inert.
async function start(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '11')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.mouse.move(5, 5)
}

test('one Sell card carries the 1-2-3 count and plays the picked one', async ({ page }) => {
  await start(page)
  const sell = page.locator('.action-sell[data-hand-card]')
  await expect(sell).toHaveCount(1)
  await expect(page.locator('[data-hand-card]', { hasText: /^Sell\s*[123]/ })).toHaveCount(0)
  const pips = sell.locator('.sell-count-pip')
  await expect(pips).toHaveCount(3)
  for (const n of [1, 2, 3]) await expect(pips.nth(n - 1)).toBeEnabled()

  const face = sell.locator('> button').first()
  await sell.getByRole('button', { name: '2 to sell' }).click()
  await expect(face).toHaveAttribute('aria-label', 'Sell 2 Produce for 2 Marks')
  await expect(sell.getByRole('button', { name: '2 to sell' })).toHaveAttribute('aria-pressed', 'true')

  // Arrow keys step the count from the card's face.
  await face.focus()
  await page.keyboard.press('ArrowRight')
  await expect(face).toHaveAttribute('aria-label', 'Sell 3 Produce for 3 Marks')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(face).toHaveAttribute('aria-label', 'Sell 1 Produce for 1 Mark')
  await page.keyboard.press('ArrowLeft')
  await expect(face).toHaveAttribute('aria-label', 'Sell 1 Produce for 1 Mark')

  // Selling 2 of 3 Produce leaves 1: the card's 2 and 3 are greyed and inert, and it plays Sell 1.
  await page.keyboard.press('ArrowRight')
  await expect(face).toHaveAttribute('aria-label', 'Sell 2 Produce for 2 Marks')
  await face.click()
  await expect(page.locator('.action-sell[data-hand-card]')).toHaveCount(1)
  const after = page.locator('.action-sell[data-hand-card]')
  await expect(after.locator('> button').first()).toHaveAttribute('aria-label', 'Sell 1 Produce for 1 Mark')
  await expect(after.locator('.sell-count-pip').nth(0)).toBeEnabled()
  await expect(after.locator('.sell-count-pip').nth(1)).toBeDisabled()
  await expect(after.locator('.sell-count-pip').nth(2)).toBeDisabled()
  await expect(after.locator('.sell-count-pip').nth(2)).toHaveAttribute('title', 'Need 2 more Produce')
  // The greyed counts don't show again as 'Saving for' strips while the card is in the hand.
  await expect(page.locator('.action-item', { hasText: 'Sell 2 Produce' }).locator('.action-why-not')).toHaveCount(0)
})
