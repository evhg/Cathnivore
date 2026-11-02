import { test, expect } from '@playwright/test'

// Plan item 36: the farm as a farmstead. On a desktop the Farm is a fixed-height frame of drawn cards, so
// the Actions frame under it stays put as the farm grows; on a phone the Farm sheet lays every bought card
// out under the producer's gate and a ribbon of what the farm makes each round.

async function actionsTop(page: import('@playwright/test').Page) {
  return page.evaluate(() => Math.round(document.querySelector('.actions-sheet')!.getBoundingClientRect().top))
}

test('at D the Actions frame does not move between round 1 and a grown farm', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.actions-sheet').waitFor()
  const before = await actionsTop(page)

  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect.poll(() => page.locator('.farmstead-thumb').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
  expect(await actionsTop(page)).toBe(before)
})

test('the phone Farm shows each producer at their gate with a ribbon and drawn cards', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'phone layout')
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: /^Farm/ }).first().click()
  await expect(page.locator('.farm-sheet .farmstead-gate')).toHaveCount(2)
  await expect(page.locator('.farm-sheet .farmstead-ribbon').first()).toContainText('each round')
  await expect(page.locator('.farm-sheet .farmstead-card .card-vignette').first()).toBeVisible()
})
