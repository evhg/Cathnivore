import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 405: on the phone counter (390x844) the playable cards are a fanned dock above the nav. Every card's
// family seal and price show on its strip, none lies under the nav, and one card is lifted whole (140 px+). A tap on
// a strip lifts that card without playing it. (`?e2eHandFan=1`: other specs see the plain row, see Game.tsx.)
async function dock(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.controls')!.getBoundingClientRect()
    const row = document.querySelector<HTMLElement>('.action-tray .actions')!.getBoundingClientRect()
    const shows = (card: Element, el: Element | null) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      // a point 6 px in from the element's left edge, at mid-height: the strip's side
      const x = Math.min(r.left + 6, r.right - 1)
      const hit = document.elementFromPoint(x, r.top + r.height / 2)
      return !!hit && card.contains(hit)
    }
    return [...document.querySelectorAll<HTMLElement>('.action-tray .actions > .action-item[data-fan]')].map((c) => {
      const r = c.getBoundingClientRect()
      return {
        name: c.dataset.fan ?? '',
        lifted: c.dataset.lifted !== undefined,
        width: c.offsetWidth,
        seal: shows(c, c.querySelector('.action-seal')),
        cost: shows(c, c.querySelector('.action-cost')),
        // plan item 635: its name shows whole, not under another card
        title: (() => {
          const l = c.querySelector('.action-label')
          if (!l) return false
          const lr = l.getBoundingClientRect()
          const hit = document.elementFromPoint(Math.min(lr.left + lr.width / 2, row.right - 2), lr.top + lr.height / 2)
          return !!hit && c.contains(hit) && parseFloat(getComputedStyle(l).fontSize) >= 12 && getComputedStyle(l).color !== 'rgba(0, 0, 0, 0)'
        })(),
        inRow: r.left >= row.left - 2 && r.right <= row.right + 2,
        bottom: r.bottom,
        navTop: nav.top,
      }
    })
  })
}

test('phone counter: the hand is a fanned dock, every card readable, a tap lifts it unplayed', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?e2eHandFan=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '103')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.action-tray .actions[data-fan]').waitFor()
  await page.waitForTimeout(800)
  const cards = await dock(page)
  expect(cards.length).toBeGreaterThanOrEqual(4)
  expect(cards.filter((c) => c.lifted).length).toBe(1)
  for (const c of cards) {
    expect(c.bottom, `${c.name} clear of the nav`).toBeLessThanOrEqual(c.navTop + 1)
    if (!c.inRow) continue // a long hand scrolls; the cards in the row are checked
    expect(c.seal, `${c.name}'s seal shows`).toBe(true)
    expect(c.cost, `${c.name}'s price shows`).toBe(true)
  }
  // Plan item 635 (was item 405's six strips in view): the cards no longer overlap, so three or more stand whole in
  // the row and each in it shows its name; the rest are a swipe away
  expect(cards.filter((c) => c.inRow).length).toBeGreaterThanOrEqual(Math.min(cards.length, 3))
  for (const c of cards.filter((x) => x.inRow)) expect(c.title, `${c.name}'s name shows`).toBe(true)
  expect(cards.find((c) => c.lifted)!.width).toBeGreaterThanOrEqual(140)

  // tap the strip of a card that isn't lifted
  const target = cards.findIndex((c) => !c.lifted && c.inRow)
  const ledger = await page.locator('.active-producer').textContent()
  const card = page.locator('.action-tray .actions > .action-item[data-fan]').nth(target)
  const box = (await card.boundingBox())!
  await page.mouse.click(box.x + 10, box.y + box.height / 2)
  await expect.poll(async () => (await dock(page))[target]!.lifted, { timeout: 3000 }).toBe(true)
  await page.waitForTimeout(400)
  const after = await dock(page)
  expect(after[target]!.width).toBeGreaterThanOrEqual(140)
  expect(after.filter((c) => c.lifted).length).toBe(1)
  await expect(page.locator('.active-producer')).toHaveText(ledger ?? '')
})
