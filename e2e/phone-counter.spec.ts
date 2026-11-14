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
