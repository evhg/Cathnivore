import { expect, test } from './own-gpu'

// Plan item 481: on the class pick each skill tree is a button that plays its signature active on the stage: the
// pick and the scene take `data-skillpreview` within 150 ms of the press, her line shows under the sheet, T plays the
// class's trees in turn, and a class switch ends a preview.
test('a skill tree plays its preview on the pick', async ({ page }) => {
  test.setTimeout(400_000)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?rs=0.5')
  await page.locator('#btn-begin').click({ timeout: 300_000 })
  const pick = page.locator('.cp')
  await expect(pick).toBeVisible({ timeout: 300_000 })
  // the street is up and drawing the pick (the pick can open before it, and a preview then waits for it)
  await expect(page.locator('canvas[data-target-at]')).toHaveCount(1, { timeout: 300_000 })
  const rows = page.locator('.cp-tree[role="button"]')
  await expect(rows).toHaveCount(3)
  const first = rows.first()
  const tree = await first.getAttribute('data-tree')
  await page.evaluate(() => {
    const w = window as unknown as { __press: number; __seen: number }
    const root = document.querySelector('.cp')!
    addEventListener('pointerdown', () => (w.__press = performance.now()), { capture: true })
    new MutationObserver(() => (w.__seen ??= performance.now())).observe(root, { attributes: true, attributeFilter: ['data-skillpreview'] })
  })
  await first.click()
  await expect(pick).toHaveAttribute('data-skillpreview', tree!)
  const lag = await page.evaluate(() => {
    const w = window as unknown as { __press: number; __seen: number }
    return w.__seen - w.__press
  })
  expect(lag).toBeLessThanOrEqual(150)
  await expect(page.locator('canvas[data-skillpreview]')).toHaveAttribute('data-skillpreview', tree!)
  await expect(page.locator('.cp-skill-line')).not.toBeEmpty()
  // the Ghost's first tree is Longshot: its preview slows the street to 0.3x for the shot
  if (tree === 'longshot') await expect(page.locator('canvas[data-target-at]')).toHaveAttribute('data-time-scale', '0.3')
  // T plays the trees in turn
  await page.keyboard.press('t')
  const second = await pick.getAttribute('data-skillpreview')
  expect(second).toBeTruthy()
  // a class switch ends the preview
  await page.keyboard.press('2')
  await expect(pick).toHaveAttribute('data-class', 'butcher')
  await expect(pick).not.toHaveAttribute('data-skillpreview', /.+/)
})
