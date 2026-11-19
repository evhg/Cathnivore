import { test, expect } from '@playwright/test'

// ROADMAP 57: on a phone the map is the hero of the game screen. Plan item 443: it was measured as the SVG's box (45%
// of the viewport), which the viewBox letterboxed 32 px above and below the board; now the frame hugs the board, so the
// hexes fill it: 85%+ of its height and 92%+ of its width at 390x844.
test('phone board fills its frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .map .tile-edges').waitFor() // the Setup's opening board is a .map too (item 513)
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => {
    // Plan item 519: the frame also holds the placard and the counter; the board is its svg
    const f = document.querySelector('.map-wrap svg.map')!.getBoundingClientRect()
    const h = document.querySelector('.map .tile-edges')!.getBoundingClientRect()
    return { hcov: h.height / f.height, wcov: h.width / f.width, inside: h.top >= f.top - 1 && h.bottom <= f.bottom + 1 }
  })
  expect(m.hcov).toBeGreaterThanOrEqual(0.85)
  expect(m.wcov).toBeGreaterThanOrEqual(0.92)
  expect(m.inside).toBe(true)
})

// Plan item 33: the whole board shows at 390x844 without scrolling: no hex runs under the hand.
test('phone map shows every hex above the hand', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .map').waitFor()
  const fit = await page.evaluate(() => {
    const scroll = document.querySelector('.game-scroll')!
    const view = scroll.getBoundingClientRect()
    const tiles = [...document.querySelectorAll('.region-hex polygon')].map((p) => p.getBoundingClientRect())
    return { overflow: scroll.scrollHeight - scroll.clientHeight, lowest: Math.max(...tiles.map((t) => t.bottom)), viewBottom: view.bottom }
  })
  expect(fit.overflow).toBeLessThanOrEqual(1)
  expect(fit.lowest).toBeLessThanOrEqual(fit.viewBottom)
})
