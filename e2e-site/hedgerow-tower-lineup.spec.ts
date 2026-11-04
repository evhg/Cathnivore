import { expect, test } from '@playwright/test'

// Plan item 81: the tower lineup stage. The Almanac's turntable shows each tower type's 3D model in turn; every
// type draws, and no two draw the same picture (each has its own silhouette; tests/hedgerow-tower-models.test.ts
// checks the geometry).
test('the Almanac turntable renders every tower type, each its own picture', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough for a model check')
  test.setTimeout(240_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.locator('#btn-almanac').click()
  const views = page.locator('#dlg-almanac .alm-card .alm-view')
  await expect(views.first()).toBeVisible()
  const n = await views.count()
  expect(n).toBeGreaterThanOrEqual(13)
  const shots = new Set<string>()
  for (let i = 0; i < n; i++) {
    await views.nth(i).click()
    await expect(page.locator('#almanac-view')).toBeVisible()
    await page.waitForTimeout(1500)
    shots.add((await page.locator('#almanac-canvas').screenshot()).toString('base64'))
  }
  expect(shots.size).toBe(n)
})
