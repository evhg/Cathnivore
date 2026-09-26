import { test, expect } from '@playwright/test'

// SPEC 10.2: "Tapping [a Squeeze/Expand/Scout card] highlights the matching regions on the map. This is
// the player's main planning tool and must be obvious." A fresh Quick Game's Expand slot always holds a
// Stage I Pressure card (SPEC 4.7's setup order), so this doesn't need a specific seed to exercise it.
test('tapping the Expand plan-strip card highlights its matching regions, and tapping again clears it', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const expandButton = page.locator('.plan-strip button', { hasText: 'Expand' })
  await expect(expandButton).toBeVisible()

  // Before tapping: no region is glowing or dimmed.
  await expect(page.locator('.region-hex.glow')).toHaveCount(0)
  await expect(page.locator('.region-hex.dimmed')).toHaveCount(0)

  await expandButton.click()
  await expect(expandButton).toHaveAttribute('aria-pressed', 'true')
  const glowing = page.locator('.region-hex.glow')
  await expect(glowing).not.toHaveCount(0)
  // Every non-glowing active region should be dimmed while a plan-strip highlight is active.
  const dimmedCount = await page.locator('.region-hex.dimmed').count()
  const glowCount = await glowing.count()
  const totalRegions = await page.locator('.region-hex').count()
  expect(dimmedCount + glowCount).toBe(totalRegions)

  // Tapping the same card again clears the highlight.
  await expandButton.click()
  await expect(expandButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.region-hex.glow')).toHaveCount(0)
  await expect(page.locator('.region-hex.dimmed')).toHaveCount(0)
})
