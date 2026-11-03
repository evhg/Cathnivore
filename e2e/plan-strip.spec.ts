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

// Plan item 25: looking at a plan card (hover, keyboard focus or a tap) marks exactly the hexes the rules
// will hit: every glowing hex carries data-threat for that slot, and no other hex does.
test('a plan card marks exactly its targets with data-threat, on keyboard focus and on tap', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await expect(page.locator('.plan-strip-target-full')).toHaveCount(3)
  for (const text of await page.locator('.plan-strip-target').allTextContents()) expect(text.trim()).not.toBe('—')

  const expand = page.locator('.plan-strip button', { hasText: 'Expand' })
  await expand.click()
  const threats = page.locator('.region-hex[data-threat="expand"]')
  const n = await threats.count()
  expect(n).toBeGreaterThan(0)
  await expect(page.locator('.region-hex.glow')).toHaveCount(n)
  await expect(page.locator('.region-hex.glow:not([data-threat="expand"])')).toHaveCount(0)
  await expand.click()
  await expect(page.locator('.region-hex[data-threat]')).toHaveCount(0)

  // Keyboard: Tab onto the card peeks its targets without pinning; moving on clears them.
  await expand.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(expand).toBeFocused()
  await expect(page.locator('.region-hex[data-threat="expand"]')).toHaveCount(n)
  await expect(expand).toHaveAttribute('aria-pressed', 'false')
})

// Plan item 47: on a phone the plan cards' target lines are whole (the full by-region line was cut at two lines).
test('the phone plan cards show their target line whole', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'a phone layout')
  for (let seed = 0; seed < 3; seed++) {
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game').waitFor()
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.plan-strip-target')]
        .filter((e) => e.getBoundingClientRect().width > 2)
        .filter((e) => e.scrollHeight > e.clientHeight + 1)
        .map((e) => e.textContent),
    )
    expect(cut).toEqual([])
  }
})
