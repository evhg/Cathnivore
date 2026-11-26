import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Plan item 708: at 1440x900 the readings are a ruled paper ledger (labels 12 px+, figures 22 px+) and Pell's
// medallion is 120 px+; the ledger, Pell, the plan slab and the hexes don't overlap, and the ledger passes AA.
for (const scheme of ['light', 'dark'] as const) {
  test(`the ledger and Pell at 1440x900 ${scheme}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the big desktop table')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.table-cath').waitFor()
    await page.locator('.rival-frame').waitFor()
    const m = await page.evaluate(() => {
      type R = { l: number; t: number; r: number; b: number }
      const box = (e: Element): R => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }
      const fs = (e: Element) => parseFloat(getComputedStyle(e).fontSize)
      const labels = [...document.querySelectorAll('.market-board .board-label')].filter((e) => e.getBoundingClientRect().width > 2).map(fs)
      const nums = [...document.querySelectorAll('.market-board .board-num')].map(fs)
      const hexes = [...document.querySelectorAll('.region-hex polygon')].map(box).filter((b) => b.r > b.l)
      return { labels, nums, ledger: box(document.querySelector('.market-board')!), pell: box(document.querySelector('.rival-frame')!), slab: box(document.querySelector('.plan-strip')!), hexes }
    })
    const meet = (a: { l: number; t: number; r: number; b: number }, b: typeof a) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    expect(m.labels).toHaveLength(4)
    for (const s of m.labels) expect(s, 'ledger label').toBeGreaterThanOrEqual(12)
    expect(m.nums).toHaveLength(4)
    for (const s of m.nums) expect(s, 'ledger figure').toBeGreaterThanOrEqual(22)
    expect(m.pell.r - m.pell.l, 'Pell medallion').toBeGreaterThanOrEqual(120)
    expect(meet(m.ledger, m.pell), 'ledger and Pell').toBe(false)
    expect(meet(m.ledger, m.slab), 'ledger and slab').toBe(false)
    expect(meet(m.pell, m.slab), 'Pell and slab').toBe(false)
    // The hex polygons' boxes are wider than the hexes (their corners): test Pell and the ledger against the board's
    // left edge where they stand (the leftmost hex column's box starts below them).
    for (const h of m.hexes) {
      expect(meet(m.ledger, h), 'ledger and a hex').toBe(false)
      expect(meet(m.slab, h) && h.t < m.slab.t, 'slab over a hex top').toBe(false)
    }
    const axe = await new AxeBuilder({ page }).include('.market-board').withRules(['color-contrast']).analyze()
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
  })
}

// Plan item 708: the quarterly-plan slab's words pass AA on its acrylic (axe, both schemes).
for (const scheme of ['light', 'dark'] as const) {
  test(`the plan slab reads at AA at 1440x900 ${scheme}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the big desktop table')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.plan-strip').waitFor()
    const axe = await new AxeBuilder({ page }).include('.plan-strip').withRules(['color-contrast']).analyze()
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.message ?? ''}`))).toEqual([])
  })
}

// On a chapter's board a region's name plate can stand in the cloth's top-left (Word of Mouth's Highmoor at
// 1440x900 ran under his 120 px frame): Pell steps down a size until clear of every plate, never under 80 px.
test('Pell keeps clear of a chapter\'s name plates at 1440x900', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'the big desktop table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Word of Mouth/ }).click()
  const solo = page.getByRole('button', { name: /^Solo/ })
  if (await solo.isVisible().catch(() => false)) await solo.click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('[data-seal-card]').waitFor({ timeout: 60_000 })
  await page.locator('.rival-frame').waitFor()
  await expect.poll(async () => page.evaluate(() => {
    const f = document.querySelector('.rival-frame')!.getBoundingClientRect()
    const plates = [...document.querySelectorAll('.map-wrap .region-plaque')].map((p) => p.getBoundingClientRect())
    return plates.filter((p) => f.left < p.right && p.left < f.right && f.top < p.bottom && p.top < f.bottom).length
  })).toBe(0)
  const size = await page.locator('.rival-frame').evaluate((e) => e.getBoundingClientRect().width)
  expect(size).toBeGreaterThanOrEqual(80)
})
