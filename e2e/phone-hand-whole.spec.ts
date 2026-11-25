import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 701: on the phone counter the hand rests with no face cut by the screen's edge: Cath's lifted card stands
// whole (clear of the right edge's fade), any card only partly in view is face down (counted by the edge's tab), and
// the cards swiped past the left edge are counted there too.
const faces = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('.action-tray .actions')!
    const out = [...row.querySelectorAll<HTMLElement>(':scope > .action-item[data-hand-card]')].map((e) => {
      const r = e.getBoundingClientRect()
      return { left: r.left, right: r.right, lifted: e.hasAttribute('data-lifted'), down: e.hasAttribute('data-cut-right') }
    })
    return { cards: out, fan: row.dataset.fan !== undefined, left: row.dataset.moreLeft ?? '', vw: innerWidth }
  })

for (const [w, h] of [[390, 844], [375, 812], [430, 932]] as const) {
  test(`the counter hand rests with whole faces at ${w}x${h}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the phone counter')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/?e2eHandFan=1')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.action-tray .actions[data-fan]')).toBeAttached()
    const check = async (at: string) => {
      await page.waitForTimeout(900)
      const m = await faces(page)
      expect(m.fan, at).toBe(true)
      const lifted = m.cards.find((c) => c.lifted)!
      expect(lifted, `${at}: a lifted card`).toBeTruthy()
      expect(lifted.left, `${at}: lifted card inside the left edge`).toBeGreaterThanOrEqual(-3)
      expect(lifted.right, `${at}: lifted card clear of the right fade`).toBeLessThanOrEqual(m.vw - 36 + 4)
      for (const [i, c] of m.cards.entries()) {
        const showing = c.right > 3 && c.left < m.vw - 3
        if (showing && !c.down) {
          expect(c.left, `${at}: card ${i} face inside the left edge`).toBeGreaterThanOrEqual(-3)
          expect(c.right, `${at}: card ${i} face inside the right edge`).toBeLessThanOrEqual(m.vw + 3)
        }
      }
      const past = m.cards.filter((c) => (c.left + c.right) / 2 < 0).length
      expect(m.left, `${at}: the left tab counts the cards swiped past`).toBe(past ? String(past) : '')
    }
    await check(`${w}x${h} rest`)
    // a tap on each card that isn't lifted lifts it, and the hand brings it whole into view
    const n = (await faces(page)).cards.length
    for (const i of [0, n - 1]) {
      const card = page.locator('.action-tray .actions > .action-item[data-hand-card]').nth(i)
      await card.evaluate((e) => e.scrollIntoView({ inline: 'nearest', block: 'nearest' }))
      await page.waitForTimeout(400)
      if ((await card.getAttribute('data-lifted')) === null) await card.locator('button').first().click()
      await expect(card).toHaveAttribute('data-lifted', '')
      await check(`${w}x${h} after lifting card ${i}`)
    }
  })
}
