import { test, expect } from '@playwright/test'

// Plan item 218: on a big desktop each card in the hand is a painted card: a picture window 96x56 px or more across
// its top (down its left side on a two-row turn), the name under it at 14 px or more (12 px where it's set tight), the price at its foot, none of the three meeting another.
test('desktop hand cards carry a picture window, the name and the price apart', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop hand')
  for (let round = 0; round < 3; round++) {
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(1, 1)
    await expect(page.locator('.table-hand [data-hand-card]').first()).toBeVisible()
    await page.waitForTimeout(600)
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.table-hand .action-item:not(.action-family)')].map((c) => {
        // Measured upright: the fan's tilt inflates the boxes of a card's parts into each other.
        c.style.transition = 'none'
        c.style.transform = 'none'
        const art = c.querySelector('svg.action-art[data-scene]')?.getBoundingClientRect()
        const label = c.querySelector('.action-label')!
        const range = document.createRange()
        range.selectNodeContents(label)
        const svg = label.querySelector(':scope > svg')
        if (svg) range.setStartAfter(svg)
        const name = range.getBoundingClientRect()
        const cost = c.querySelector('.action-cost')?.getBoundingClientRect()
        const meet = (a?: DOMRect, b?: DOMRect) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        return {
          name: c.textContent ?? '',
          art: art ? [art.width, art.height] : [0, 0],
          font: parseFloat(getComputedStyle(label).fontSize),
          // A dense card, or a turn dealt in two rows of landscape cards, sets its name at the 12 px label size.
          dense: c.dataset.dense !== undefined || c.closest<HTMLElement>('.table-hand')!.dataset.rows !== undefined,
          clash: meet(art, name) || meet(name, cost) || meet(art, cost),
        }
      }),
    )
    expect(cards.length).toBeGreaterThanOrEqual(3)
    for (const c of cards) {
      expect(c.art[0], `${c.name} art width`).toBeGreaterThanOrEqual(96)
      expect(c.art[1], `${c.name} art height`).toBeGreaterThanOrEqual(56)
      if (!c.dense) expect(c.font, `${c.name} name size`).toBeGreaterThanOrEqual(13.9)
      expect(c.clash, `${c.name}: picture, name and price apart`).toBe(false)
    }
  }
})
