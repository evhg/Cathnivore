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
  // Plan item 8: Play again is the primary action, with the round-by-round chart and a grade.
  await expect(page.locator('.end-actions .primary')).toContainText('Play again')
  await expect(page.locator('.end-chart svg')).toBeVisible()
  if (test.info().project.name === 'desktop-chromium') {
    // At D the chart sits above the fold, beside the story column.
    const chart = (await page.locator('.end-chart').boundingBox())!
    expect(chart.y + chart.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  }
  await expect(page.locator('.end-grade')).toHaveAttribute('data-grade', /^[SABCD]$/)

  // SPEC 4.8: "the end screen shows the reason, a short story line, and stats: regions liberated, rounds
  // played, cards bought and schemes played."
  await expect(page.locator('.end-screen-story')).not.toBeEmpty()
  await expect(page.locator('.end-screen-stats')).toContainText(/bought/)
  await expect(page.locator('.end-screen-stats')).toContainText(/played/)

  expect(errors).toEqual([])
})

// Plan item 8: "Play again" replays the same seed, so an autoplayed game ends exactly the same way.
test('Play again starts the same seed', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const end = page.locator('.end-screen')
  await expect(end).toBeVisible({ timeout: 30_000 })
  const seed = await end.getAttribute('data-seed')
  const stats = await page.locator('.end-screen-stats').textContent()
  await page.getByRole('button', { name: /Play again/ }).click()
  await expect(end).toBeVisible({ timeout: 30_000 })
  expect(await end.getAttribute('data-seed')).toBe(seed)
  await expect(page.locator('.end-screen-stats')).toHaveText(stats!)
  // New game goes back to Setup.
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
})
