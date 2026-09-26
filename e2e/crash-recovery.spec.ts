import { test, expect } from '@playwright/test'

// SPEC 11.3: "A global error screen catches crashes and offers Resume From Last Autosave, Copy Bug Report
// (JSON with config, seed, actions and error) and Back to Title." Never previously exercised end to end —
// a real crash can't be scripted from outside the app, so `App.tsx` throws on the test-only `?e2eCrash=1`
// query param (gone from the URL the moment either button below navigates away, so there's no crash loop).
test('the global error screen offers Back to Title, and Resume From Last Autosave resumes a real game', async ({ page }) => {
  // Start a real Quick Game first so there's an actual autosave to resume from.
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })

  // Force the crash screen.
  await page.goto('/?e2eCrash=1')
  await expect(page.getByText('Something went wrong.')).toBeVisible()
  const crashScreen = page.locator('.crash-screen')
  await expect(crashScreen.getByRole('button', { name: 'Resume From Last Autosave' })).toBeVisible()
  await expect(crashScreen.getByRole('button', { name: 'Copy Bug Report' })).toBeVisible()
  await expect(crashScreen.getByRole('button', { name: 'Back to Title' })).toBeVisible()

  // Back to Title strips the crash flag and returns to a normal, working title screen.
  await crashScreen.getByRole('button', { name: 'Back to Title' }).click()
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
  await expect(page.getByText('Something went wrong.')).toHaveCount(0)
  expect(page.url()).not.toContain('e2eCrash')

  // Crash again, then Resume From Last Autosave should replay the finished game's autosave rather than
  // stopping at the title screen (the completed game's autosave is still what `loadGame()` returns, since
  // nothing since Quick Game's Start has overwritten it).
  await page.goto('/?e2eCrash=1')
  await page.locator('.crash-screen').getByRole('button', { name: 'Resume From Last Autosave' }).click()
  await expect(page.getByText('Something went wrong.')).toHaveCount(0)
  expect(page.url()).not.toContain('e2eCrash')
})
