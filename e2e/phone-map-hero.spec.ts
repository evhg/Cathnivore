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

// Plan item 33: the whole board shows at 390x844 without scrolling: no hex runs under the hand.
test('phone map shows every hex above the hand', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map').waitFor()
  const fit = await page.evaluate(() => {
    const scroll = document.querySelector('.game-scroll')!
    const view = scroll.getBoundingClientRect()
    const tiles = [...document.querySelectorAll('.region-hex polygon')].map((p) => p.getBoundingClientRect())
    return { overflow: scroll.scrollHeight - scroll.clientHeight, lowest: Math.max(...tiles.map((t) => t.bottom)), viewBottom: view.bottom }
  })
  expect(fit.overflow).toBeLessThanOrEqual(1)
  expect(fit.lowest).toBeLessThanOrEqual(fit.viewBottom)
})
