import { test, expect } from '@playwright/test'

// Plan item 218: on a big desktop each card in the hand is a painted card: a picture window 96x56 px or more across
// its top (down its left side on a two-row turn), the name under it at 14 px or more (12 px where it's set tight), the price at its foot, none of the three meeting another.
// Plan item 320: in one row the price is a tag pinned over the picture's lower edge (the picture takes 60% of the face),
// so there it may meet the picture, but never the name.
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
        // the name follows the label's pictures (the window, and item 320's family seal pinned to the corner)
        const svgs = label.querySelectorAll(':scope > svg')
        if (svgs.length) range.setStartAfter(svgs[svgs.length - 1]!)
        const name = range.getBoundingClientRect()
        const cost = c.querySelector('.action-cost')?.getBoundingClientRect()
        const meet = (a?: DOMRect, b?: DOMRect) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        return {
          name: c.textContent ?? '',
          art: art ? [art.width, art.height] : [0, 0],
          rows: c.closest<HTMLElement>('.table-hand')!.dataset.rows !== undefined,
          width: c.getBoundingClientRect().width,
          font: parseFloat(getComputedStyle(label).fontSize),
          // A dense card, or a turn dealt in two rows of landscape cards, sets its name at the 12 px label size.
          dense: c.dataset.dense !== undefined || c.closest<HTMLElement>('.table-hand')!.dataset.rows !== undefined,
          clash: meet(art, name) || meet(name, cost) || (c.closest<HTMLElement>('.table-hand')!.dataset.rows !== undefined && meet(art, cost)),
        }
      }),
    )
    expect(cards.length).toBeGreaterThanOrEqual(3)
    for (const c of cards) {
      // Plan item 320: in rows the picture runs down the card's left side, about half its width (fan() sets the width
      // from the deal, so a long row of narrow cards has a window narrower than 96 px).
      if (c.rows) expect(c.art[0], `${c.name} art width in rows`).toBeGreaterThanOrEqual(c.width * 0.4)
      else expect(c.art[0], `${c.name} art width`).toBeGreaterThanOrEqual(96)
      expect(c.art[1], `${c.name} art height`).toBeGreaterThanOrEqual(56)
      if (!c.dense) expect(c.font, `${c.name} name size`).toBeGreaterThanOrEqual(13.9)
      expect(c.clash, `${c.name}: picture, name and price apart`).toBe(false)
    }
  }
})
