import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Plan item 368 slice 1: on an upright phone Cath's line and the farm's goods are one wooden counter under the board:
// the dock and the goods meet with no gap, her line is chalk on a slate (no bubble border or tail), and the goods'
// figures pass AA on the wood in both themes.
for (const scheme of ['light', 'dark'] as const) {
  test(`Cath's line and the goods are one counter (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the upright phone')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game .cath-dock').waitFor()
    const m = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>('.cath-dock')!
      const goods = document.querySelector<HTMLElement>('.action-tray .active-producer')!
      const line = document.querySelector<HTMLElement>('.cath-dock-line')!
      const map = document.querySelector<HTMLElement>('.map-wrap')!.getBoundingClientRect()
      const cs = getComputedStyle(line)
      return {
        gap: goods.getBoundingClientRect().top - dock.getBoundingClientRect().bottom,
        lineBorder: cs.borderTopWidth,
        tail: getComputedStyle(line, '::after').display,
        lineSize: parseFloat(cs.fontSize),
        wood: getComputedStyle(dock).backgroundImage.includes('gradient') && getComputedStyle(goods).backgroundImage.includes('gradient'),
        goodsBorder: getComputedStyle(goods).borderTopWidth,
        mapH: map.height,
      }
    })
    expect(m.gap).toBeLessThanOrEqual(0.5)
    expect(m.lineBorder).toBe('0px')
    expect(m.tail).toBe('none')
    expect(m.lineSize).toBeGreaterThanOrEqual(13)
    expect(m.wood).toBe(true)
    expect(m.goodsBorder).toBe('0px')
    expect(m.mapH).toBeGreaterThanOrEqual(415)
    const axe = await new AxeBuilder({ page }).include('.cath-dock').include('.action-tray .active-producer').withRules(['color-contrast']).analyze()
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
  })
}

// Plan item 368 slice 2: the hand on the counter holds three whole cards (their names unclipped) without a swipe, the
// count of cards to the right hangs from the counter's lip clear of every card, and the not-yet deck is "Saving for".
// Run with the held fan allowed (`?e2eHandFan=1`), as a player sees it: the counter turns the fan off.
for (const scheme of ['light', 'dark'] as const) {
  test(`the counter's hand shows three whole cards and its count off them (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the upright phone')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/?e2eHandFan=1')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game .cath-dock').waitFor()
    await page.waitForTimeout(600)
    const read = () => page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.action-tray .actions')!
      const rr = row.getBoundingClientRect()
      const well = document.querySelector<HTMLElement>('.action-tray .actions-well')!
      const wr = well.getBoundingClientRect()
      const pill = getComputedStyle(well, '::before')
      const pillBox = pill.content === 'none' ? null : {
        top: wr.top + parseFloat(pill.top), bottom: wr.top + parseFloat(pill.top) + parseFloat(pill.height),
        right: wr.right - parseFloat(pill.right), left: wr.right - parseFloat(pill.right) - parseFloat(pill.width),
      }
      const cards = [...row.querySelectorAll<HTMLElement>(':scope > .action-item')]
      const whole = cards.filter((c) => {
        const label = c.querySelector('.action-label')!.getBoundingClientRect()
        return c.matches('[data-hand-card]') && label.width > 0 && label.left >= rr.left - 1 && label.right <= rr.right + 1
      }).length
      const meets = pillBox ? cards.filter((c) => {
        const r = c.getBoundingClientRect()
        return r.right > rr.left && r.left < rr.right && r.left < pillBox.right && r.right > pillBox.left && r.top < pillBox.bottom && r.bottom > pillBox.top
      }).length : 0
      return {
        whole, meets, pill: pill.content,
        peeks: row.querySelectorAll('[data-peek]').length,
        later: document.querySelector('.action-tray .action-head-later')?.textContent ?? '',
        mapH: document.querySelector<HTMLElement>('.map-wrap')!.getBoundingClientRect().height,
        small: cards.filter((c) => c.getBoundingClientRect().height < 44).length,
      }
    })
    await page.locator('.action-tray .actions').evaluate((el) => el.scrollTo({ left: 0 }))
    await page.waitForTimeout(300)
    const m = await read()
    expect(m.peeks).toBe(0)
    expect(m.whole).toBeGreaterThanOrEqual(3)
    expect(m.pill).toContain('more')
    expect(m.meets).toBe(0)
    expect(m.later).toBe('Saving for')
    expect(m.mapH).toBeGreaterThanOrEqual(415)
    expect(m.small).toBe(0)
  })
}
