import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 302: on a phone the playable cards are held as a fan: every one in view at once, a 24 px strip either
// side of a whole front card, and a tap on a strip brings that card forward without playing it. (Other specs see
// the plain swiped row: Playwright clicks a card's middle, which the fan covers; `?e2eHandFan=1` turns it on.)
// Each sticky card's width and how much of it shows (sampled along its middle with elementFromPoint).
async function strips(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector('.action-tray .actions')!.getBoundingClientRect()
    const cards = [...document.querySelectorAll<HTMLElement>('.action-tray .actions > .action-item[data-peek]')]
    return cards.map((c) => {
      const r = c.getBoundingClientRect()
      let shown = 0
      for (let x = Math.ceil(r.left) + 1; x < r.right - 1; x += 2) if (c.contains(document.elementFromPoint(x, r.top + r.height / 2))) shown += 2
      const mid = c.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
      return { left: r.left, right: r.right, width: r.width, shown, mid, rowL: row.left, rowR: row.right }
    })
  })
}

test('phone: every playable card is in view, and a tap on a strip brings it forward unplayed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the held fan is the phone layout')
  await page.goto('/?e2eHandFan=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '103')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.action-tray [data-peek]').first().waitFor()
  await page.waitForTimeout(600)
  const before = await strips(page)
  expect(before.length).toBeGreaterThan(3)
  for (const c of before) {
    expect(c.left).toBeGreaterThanOrEqual(c.rowL - 1)
    expect(c.right).toBeLessThanOrEqual(c.rowR + 1)
    // 24 px strips, give or take item 164's alternating tilt (it moves each card's bounding box a few px).
    expect(c.shown).toBeGreaterThanOrEqual(18)
    expect(c.width).toBeGreaterThanOrEqual(148)
  }
  expect(before.filter((c) => c.mid).length).toBe(1)
  // The last card is a strip off the front: tap the strip.
  const last = before.length - 1
  expect(before[last]!.mid).toBe(false)
  const ledger = await page.locator('.active-producer').textContent()
  const card = page.locator('.action-tray .actions > .action-item[data-peek]').last()
  await card.click({ position: { x: before[last]!.width - 8, y: 40 }, force: true })
  await expect.poll(async () => (await strips(page))[last]!.mid, { timeout: 3000 }).toBe(true)
  await expect(page.locator('.active-producer')).toHaveText(ledger ?? '')
})
