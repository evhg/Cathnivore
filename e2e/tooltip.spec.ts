import { test, expect } from '@playwright/test'

// SPEC 10.5: "Every game term ... is explained in the rules reference and in a tap or hover tooltip."
// Covers the topbar's Public Trust/Lost Land/Rift tooltips, the bounded slice of terms wired up so far
// (see DECISIONS.md for the still-open action-button/map-legend terms).
//
// `dispatchEvent('click')` rather than `.click()`/`.tap()`: a real mouse `.click()` first fires
// `mouseenter` (the desktop-chromium project has no touch support so `.tap()` isn't available there
// either), which is a separate, hover-driven way this component also opens the same tooltip (see
// Tooltip.tsx) — dispatching the click event directly exercises the tap/click path in isolation on every
// project, phone and desktop alike.
test('tapping a topbar term shows its tooltip, and tapping again hides it', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const trigger = page.locator('.tooltip-trigger-button', { hasText: 'Rift' })
  await expect(trigger).toBeVisible()
  await expect(page.locator('.tooltip-popover')).toHaveCount(0)

  await trigger.dispatchEvent('click')
  const popover = page.locator('.tooltip-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('Cracks')

  await trigger.dispatchEvent('click')
  await expect(popover).toHaveCount(0)
})

test('clicking outside a tooltip dismisses it', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  await page.locator('.tooltip-trigger-button', { hasText: 'Trust' }).dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  await page.locator('.map-wrap').click()
  await expect(page.locator('.tooltip-popover')).toHaveCount(0)
})
