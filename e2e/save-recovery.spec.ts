import { test, expect } from '@playwright/test'

// SPEC 11.3: "If a save fails to load or is from an older version, show 'This save is from an older
// version' with Start New and Try Anyway. Never show a blank screen." Previously `loadGame()` silently
// discarded any save whose version didn't match, so an old save just made the Continue button vanish with
// no explanation — this exercises the fix end to end via a real incompatible save in localStorage.
test('an incompatible save shows the version warning with Start New and Try Anyway', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'cathnivore:save:v1',
      JSON.stringify({
        version: 2,
        config: { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ['brindleHills', 'highmoor'] },
        seed: 42,
        actions: [],
      }),
    )
  })
  await page.reload()

  await expect(page.getByText('This save is from an older version.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Try Anyway' }).click()
  await expect(page.locator('.game')).toBeVisible()
})

test("Start New clears the incompatible save and the warning doesn't return", async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('cathnivore:save:v1', 'not json')
  })
  await page.reload()

  await expect(page.getByText('This save is from an older version.')).toBeVisible()
  // Unparseable JSON has nothing to fall back on, so there's no "Try Anyway" — only Start New.
  await expect(page.getByRole('button', { name: 'Try Anyway' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Start New' }).click()
  await expect(page.getByText('This save is from an older version.')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
})
