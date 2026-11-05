import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 149: on a big desktop the cards this turn can play are a hand at the table's bottom edge: one card per
// playable action (the same cards the Actions list leads with at other sizes), each 110 px or taller, none meeting a
// region, inside the viewport, and no page scroll. What can't be played yet stays in the Actions column.
test('the actions are a hand of cards at the table edge at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only; the phone keeps its strip of art cards')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(5, 5)
    const cards = page.locator('.table-hand [data-hand-card]')
    await expect(cards.first()).toBeVisible()
    const n = await cards.count()
    expect(n, `${width}x${height}`).toBeGreaterThanOrEqual(3)
    await expect(page.locator('.actions [data-hand-card]')).toHaveCount(0)
    await expect(page.locator('.actions .action-head-later')).toBeVisible()
    const hexes = await Promise.all((await page.locator('.region-hex').all()).map(async (h) => (await h.locator('polygon').first().boundingBox())!))
    for (const card of await cards.all()) {
      const c = (await card.boundingBox())!
      expect(c.height, `${width}x${height}`).toBeGreaterThanOrEqual(110)
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.width).toBeLessThanOrEqual(width)
      expect(c.y + c.height).toBeLessThanOrEqual(height)
      for (const h of hexes) {
        const meets = c.x < h.x + h.width && h.x < c.x + c.width && c.y < h.y + h.height && h.y < c.y + c.height
        expect(meets, `${width}x${height}: ${await card.textContent()} meets a region`).toBe(false)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
    // The same cards lead the Actions list when the window is too small for the hand.
    await page.setViewportSize({ width: 1100, height: 800 })
    await expect(page.locator('.table-hand')).toHaveCount(0)
    await expect(page.locator('.actions [data-hand-card]')).toHaveCount(n)
  }
})

test('a card lifts on hover and plays from the hand', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.mouse.move(5, 5)
  const sell = page.locator('.table-hand [data-hand-card]', { has: page.getByRole('button', { name: /^Sell 1 Produce/ }) })
  await expect(sell).toBeVisible()
  const rest = (await sell.boundingBox())!
  await sell.hover()
  await expect.poll(async () => (await sell.boundingBox())!.y).toBeLessThan(rest.y - 8)
  const produce = await page.locator('.ledger-chip').first().textContent()
  await sell.getByRole('button', { name: /^Sell 1 Produce/ }).click()
  await expect.poll(() => page.locator('.ledger-chip').first().textContent()).not.toBe(produce)
})
