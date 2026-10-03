import { test, expect } from '@playwright/test'

// ROADMAP 57: on a phone the map is the hero of the game screen (at least 45% of the viewport height).
test('phone map takes at least 45% of the viewport height', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map').waitFor()
  const box = await page.locator('.map').boundingBox()
  const vh = page.viewportSize()!.height
  expect(box!.height).toBeGreaterThanOrEqual(vh * 0.45)
})
