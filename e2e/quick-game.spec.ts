import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "a full Solo Quick Game reaches the end screen, with the test driving the human
// producer through the UI using HeuristicBot choices and the AI teammate playing itself." `?e2eAutoplay=1`
// (src/ui/Game.tsx) makes every producer act via HeuristicBot instead of waiting for clicks, and skips the
// enemy-turn caption playback instantly, so the whole game (at most 10 rounds, SPEC 4.8) finishes in a
// handful of seconds instead of requiring the test to know which button to click each turn.
test('a full Solo Quick Game reaches the end screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Back to Title' })).toBeVisible()

  // SPEC 4.8: "the end screen shows the reason, a short story line, and stats: regions liberated, rounds
  // played, cards bought and schemes played."
  await expect(page.locator('.end-screen-story')).not.toBeEmpty()
  await expect(page.locator('.end-screen-stats')).toContainText(/bought/)
  await expect(page.locator('.end-screen-stats')).toContainText(/played/)

  expect(errors).toEqual([])
})
