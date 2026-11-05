import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 154: every card in the hand is 120 px or wider with its whole name, and no two cards overlap by more
// than a fifth of the narrower one.
async function expectWholeCards(page: Page, what: string) {
  const cards = await page.locator('.table-hand [data-hand-card]').evaluateAll((els) =>
    els.map((e) => {
      const el = e as HTMLElement
      const label = el.querySelector<HTMLElement>('.action-label, .action-family-text')
      // Layout boxes (the fan's small tilt aside): where each card lies in the hand.
      return {
        name: el.textContent ?? '',
        w: el.offsetWidth,
        x: el.offsetLeft, y: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight,
        clipped: label ? label.scrollWidth > label.clientWidth + 1 : false,
      }
    }),
  )
  for (const c of cards) {
    expect(c.w, `${what}: ${c.name} width`).toBeGreaterThanOrEqual(120)
    expect(c.clipped, `${what}: ${c.name} name cut`).toBe(false)
  }
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i]!, b = cards[j]!
      const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x))
      const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y))
      if (oy < 20) continue
      expect(ox, `${what}: ${a.name} / ${b.name} overlap`).toBeLessThanOrEqual(0.2 * Math.min(a.w, b.w) + 0.5)
    }
}

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
    await expectWholeCards(page, `${width}x${height}`)
    // The producer frame is the active producer's seat: their portrait 180 px or taller.
    const seat = page.locator('.producer-sheet [data-seat-producer]')
    await expect(seat).toBeVisible()
    expect((await seat.locator('svg').first().boundingBox())!.height, `${width}x${height} seat`).toBeGreaterThanOrEqual(180)
    // What can't be played yet lies face down beside the hand, one count for the column's 'Not yet' strips.
    const later = page.locator('.desktop-rail .hand-later')
    const strips = await page.locator('.actions .action-head-later ~ .action-item').count()
    await expect(later).toHaveAttribute('data-later', String(strips))
    const pile = (await later.boundingBox())!
    expect(pile.x + pile.width).toBeLessThanOrEqual(width)
    expect(pile.y + pile.height).toBeLessThanOrEqual(height)
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

test('a turn with more cards than a row holds spills into two rows of whole cards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
  await page.setViewportSize({ width: 1240, height: 780 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '13')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.mouse.move(5, 5)
  await expect(page.locator('.table-hand [data-hand-card]').first()).toBeVisible()
  await expect(page.locator('.table-hand')).toHaveAttribute('data-rows', '2')
  await expectWholeCards(page, '1240x780')
  const tops = (await page.locator('.table-hand [data-hand-card]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))).sort((a, b) => a - b)
  expect(tops.filter((t, i) => i > 0 && t - tops[i - 1]! > 40).length + 1, 'rows').toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(780)
})
