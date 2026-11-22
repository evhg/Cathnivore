import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 664: at D the hand rests as a tray (120 px or less) so the board is the hero; a card rises to its full
// painted face on hover or keyboard focus, and the keyboard reaches every card.
test('the desktop hand rests as a tray and a card rises on focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only; the phone keeps its own hand')
  test.setTimeout(90_000)
  for (const [width, height, share] of [[1440, 900, 0.4], [1280, 800, 0.29]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(5, 5)
    const cards = page.locator('.table-hand:not([data-rows]) .action-item')
    await expect(cards.first()).toBeVisible()
    await page.waitForTimeout(500)
    const hand = (await page.locator('.table-hand').boundingBox())!
    expect(hand.height, `${width}x${height}: the tray`).toBeLessThanOrEqual(120)
    // the board's hexes (their land polygons) take more of the screen than before the tray (38.3% / 27.3%; 40.9% / 29.7% after)
    const hex = await page.locator('.region-hex > polygon.land-layer:first-child').evaluateAll((ps) => {
      const bs = ps.map((p) => p.getBoundingClientRect())
      return (Math.max(...bs.map((b) => b.right)) - Math.min(...bs.map((b) => b.left))) * (Math.max(...bs.map((b) => b.bottom)) - Math.min(...bs.map((b) => b.top)))
    })
    expect(hex / (width * height), `${width}x${height}: the board's share`).toBeGreaterThanOrEqual(share)
    // Tab reaches every card in the hand, and the focused one rises to its full face.
    const n = await cards.count()
    const reached = new Set<number>()
    for (let i = 0; i < 80 && reached.size < n; i++) {
      await page.keyboard.press('Tab')
      const at = await page.evaluate(() => {
        const item = document.activeElement?.closest('.table-hand .action-item')
        return item ? [...document.querySelectorAll('.table-hand .action-item')].indexOf(item) : -1
      })
      if (at < 0) continue
      reached.add(at)
      await expect.poll(() => cards.nth(at).evaluate((e) => (e as HTMLElement).offsetHeight), `${width}x${height}: card ${at} rises`).toBeGreaterThanOrEqual(124)
    }
    expect(reached.size, `${width}x${height}: cards reached by Tab`).toBe(n)
    // at rest (focus elsewhere) every card is back in the tray
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.mouse.move(5, 5)
    await expect.poll(() => cards.evaluateAll((els) => Math.max(...els.map((e) => (e as HTMLElement).offsetHeight)))).toBeLessThanOrEqual(104)
  }
})
