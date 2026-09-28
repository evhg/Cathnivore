import { test, expect } from '@playwright/test'

// ROADMAP 9 "clear disabled and why-not states": Sell's missing counts (Produce too low for 2 or 3) get
// a disabled placeholder button with a reason, right where the real button would be, instead of the
// count range quietly shrinking with no explanation. A fresh Quick Game always starts with 3 Produce
// (enough to legally Sell 1-3), so this spends it down first to reach the disabled state.
test('Sell shows a disabled, explained placeholder for counts the player can no longer afford', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  // All 3 Sell counts are legal, real buttons at the start — no disabled placeholder yet.
  await expect(page.getByRole('button', { name: /^Sell 3 Produce/ })).toBeEnabled()
  await expect(page.locator('.action-why-not')).toHaveCount(0)

  await page.getByRole('button', { name: /^Sell 3 Produce/ }).click()
  await page.locator('.actions').waitFor()

  // Produce is now 0: all 3 Sell counts render as disabled placeholders, each with its own reason and
  // a cost chip still showing the amount it would take.
  const disabledSell1 = page.getByRole('button', { name: /^Sell 1 Produce/ })
  const disabledSell2 = page.getByRole('button', { name: /^Sell 2 Produce/ })
  const disabledSell3 = page.getByRole('button', { name: /^Sell 3 Produce/ })
  await expect(disabledSell1).toBeDisabled()
  await expect(disabledSell2).toBeDisabled()
  await expect(disabledSell3).toBeDisabled()
  await expect(page.locator('.action-item', { hasText: 'Sell 1 Produce' }).locator('.action-why-not')).toHaveText('Need 1 more Produce')
  await expect(page.locator('.action-item', { hasText: 'Sell 2 Produce' }).locator('.action-why-not')).toHaveText('Need 2 more Produce')
  await expect(page.locator('.action-item', { hasText: 'Sell 3 Produce' }).locator('.action-why-not')).toHaveText('Need 3 more Produce')

  // Still explained by the same "Sell" glossary tooltip a real Sell button offers (SPEC 10.5).
  const disabledTrigger = page.locator('.action-item', { hasText: 'Sell 1 Produce' }).locator('.tooltip-trigger-button')
  await disabledTrigger.dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  // A disabled button is genuinely inert: clicking it (force, since Playwright's normal click refuses a
  // disabled target) must not change game state — the active producer's turn stays exactly where it was.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await disabledSell1.click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')
})
