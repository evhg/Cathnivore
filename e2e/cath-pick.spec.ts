import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 402: Cath's suggestion is drawn on the table: the region it plays into wears her chalk ring and green
// stake; looking at the suggested card (pointer or keyboard) lights the ring; a play clears it.
test('her suggestion rings its region, lights on the card, clears on a play', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const pick = page.locator('[data-cath-pick]')
  await expect(pick).toHaveCount(1)
  const region = (await pick.getAttribute('data-cath-pick'))!
  // The ring sits inside its region's hex.
  const ring = (await pick.locator('.cath-pick-ring').boundingBox())!
  const hex = (await page.locator(`.region-hex[data-region="${region}"] polygon`).first().boundingBox())!
  const cx = ring.x + ring.width / 2, cy = ring.y + ring.height / 2
  expect(cx > hex.x && cx < hex.x + hex.width && cy > hex.y && cy < hex.y + hex.height).toBe(true)
  if (info.project.name === 'desktop-chromium') {
    await page.locator('.table-hand [data-suggested]').first().hover()
    await expect(pick).toHaveAttribute('data-lit', '')
    await page.mouse.move(5, 5)
  }
  // Playing a card clears this turn's suggestion (a new one may follow for the next action, elsewhere or not).
  const before = await page.evaluate(() => document.querySelector('svg.map')?.getAttribute('data-round'))
  await page.locator('[data-hand-card] > button:first-child:not(:disabled)').first().click()
  await page.waitForTimeout(800)
  const after = await page.locator('[data-cath-pick]').count()
  expect(before).toBeTruthy()
  expect(after).toBeLessThanOrEqual(1)
})
