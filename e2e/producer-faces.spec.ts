import { test, expect } from '@playwright/test'

// Plan item 80: the producers' faces follow the game. In an autoplayed game, the active producer's cameo swaps to
// a worried face after a Squeeze lands on one of their Stalls, or a delighted one when their ability fires.
test('the active producer reacts to the turn', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.producer-cameo svg.producer-art').first()).toBeVisible()
  const seen = new Set<string>()
  const deadline = Date.now() + 70_000
  while (Date.now() < deadline && !(seen.has('worried') || seen.has('delighted'))) {
    const face = await page.locator('.producer-cameo svg.producer-art').first().getAttribute('data-face').catch(() => null)
    if (face) seen.add(face)
    await page.waitForTimeout(60)
  }
  expect(seen.has('worried') || seen.has('delighted'), `faces seen: ${[...seen].join(', ')}`).toBe(true)
})
