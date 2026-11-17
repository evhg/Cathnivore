import { expect, test } from './own-gpu'

// Plan item 464: on the title route's pick a bottle on a crate stands at Cath's right, in frame and clear of the
// sheet; a test shot reaches the scene within 100 ms of the press (the flash is spawned in that same call, so it
// draws on the next frame), breaks the bottle, and a new class stands a fresh one.
test('the pick has a test-fire target: in frame, broken by a shot, stood again for a new class', async ({ page }) => {
  test.setTimeout(400_000)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?rs=0.5')
  await page.locator('#btn-begin').click({ timeout: 300_000 })
  const pick = page.locator('.cp')
  await expect(pick).toBeVisible({ timeout: 300_000 })
  const canvas = page.locator('canvas[data-target-at]')
  await expect(canvas).toHaveCount(1, { timeout: 60_000 })
  // In frame and not under the sheet (or, at D, the class list).
  const where = await canvas.evaluate((c) => {
    const [x, y] = c.dataset.targetAt!.split(',').map(Number) as [number, number]
    const r = c.getBoundingClientRect()
    const px = { x: r.left + ((x + 1) / 2) * r.width, y: r.top + ((1 - y) / 2) * r.height }
    const under = [...document.querySelectorAll('.cp-sheet, .cp-list')].some((e) => {
      const b = e.getBoundingClientRect()
      return b.width > 0 && px.x > b.left && px.x < b.right && px.y > b.top && px.y < b.bottom
    })
    return { px, w: innerWidth, h: innerHeight, under }
  })
  expect(where.px.x, JSON.stringify(where)).toBeGreaterThan(0)
  expect(where.px.x, JSON.stringify(where)).toBeLessThan(where.w)
  expect(where.px.y, JSON.stringify(where)).toBeGreaterThan(0)
  expect(where.px.y, JSON.stringify(where)).toBeLessThan(where.h)
  expect(where.under, JSON.stringify(where)).toBe(false)
  // Press to scene: the canvas counts the shot in the press's own task.
  const button = page.locator('.cp-testfire')
  const fire = (await button.isVisible()) ? button : page.locator('.cp-weapon-art')
  await page.evaluate(() => {
    const w = window as unknown as { __press: number; __shot: number }
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-target-at]')!
    addEventListener('pointerdown', () => (w.__press = performance.now()), { capture: true })
    new MutationObserver(() => (w.__shot ??= performance.now())).observe(c, { attributes: true, attributeFilter: ['data-testfire'] })
  })
  await fire.click()
  await expect(canvas).toHaveAttribute('data-target', 'broken')
  const lag = await page.evaluate(() => {
    const w = window as unknown as { __press: number; __shot: number }
    return w.__shot - w.__press
  })
  expect(lag).toBeLessThanOrEqual(100)
  await page.keyboard.press('2')
  await expect(pick).toHaveAttribute('data-class', 'butcher')
  await expect(canvas).toHaveAttribute('data-target', 'standing')
})
