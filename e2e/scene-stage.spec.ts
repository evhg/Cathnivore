import { expect, test } from '@playwright/test'

// Plan item 5: the graphic-novel Scene. Speakers stand at least half the viewport tall, on a painted
// backdrop, Cath on the left and the cast on the right.
test('scene speakers are at least half the viewport tall', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Campaign').click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await page.locator('.scene').waitFor()
  await expect(page.locator('.scene-backdrop')).toBeVisible()
  const vh = page.viewportSize()!.height
  const cath = page.locator('.scene-fig-left.is-speaking')
  await expect(cath).toBeVisible()
  expect((await cath.boundingBox())!.height).toBeGreaterThanOrEqual(vh * 0.5)
  // Line 3 is Mara's: she wipes in on the right while Cath stays on stage, listening.
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  const mara = page.locator('.scene-fig-right.is-speaking')
  await expect(mara).toBeVisible()
  expect((await mara.boundingBox())!.height).toBeGreaterThanOrEqual(vh * 0.5)
  await expect(page.locator('.scene-fig-left.is-listening')).toBeVisible()
  await expect(page.locator('.scene-bubble-right')).toContainText('Mara')
})
