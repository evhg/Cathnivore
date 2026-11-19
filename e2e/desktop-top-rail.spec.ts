import { expect, test } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 540: on a desktop the table's top rail is one clean row (the round dashboard, Hollowell's three moves with
// the stage tab inside its card, his medallion, the drawer tabs), every hand card whole above the screen's foot, and
// the Market, Plan and Log drawer tabs real targets (44 px or more).
for (const [width, height] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`the top rail is one clean row and the hand sits whole at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game').waitFor()
    await page
      .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 4000 })
      .catch(() => {})

    const m = await page.evaluate(() => {
      const box = (e: Element) => {
        const r = e.getBoundingClientRect()
        return { l: r.left, t: r.top, r: r.right, b: r.bottom }
      }
      const vis = (s: string) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map(box)
      const rail = [...vis('.market-board'), ...vis('.plan-strip-item'), ...vis('.rival'), ...vis('.desktop-rail .drawer-rail')]
      let overlaps = 0
      for (let i = 0; i < rail.length; i++)
        for (let j = i + 1; j < rail.length; j++) {
          const a = rail[i]!
          const b = rail[j]!
          if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps++
        }
      // the stage tab inside its own card
      const stage = [...document.querySelectorAll('.plan-strip-item')]
        .filter((i) => i.querySelector('.plan-strip-stage')?.getClientRects().length)
        .map((i) => ({ card: box(i.querySelector(':scope > button')!), tab: box(i.querySelector('.plan-strip-stage')!) }))
      const cards = vis('.table-hand .action-item')
      const keys = vis('.desktop-rail .drawer-key')
      const key = document.querySelector('.map-wrap > .map-key')
      return { n: rail.length, overlaps, stage, bottoms: cards.map((c) => c.b), keys, mapKey: key ? box(key) : null }
    })
    expect(m.n, 'rail pieces found').toBeGreaterThanOrEqual(5)
    expect(m.overlaps, 'overlaps between the rail’s pieces').toBe(0)
    for (const { card, tab } of m.stage) {
      expect(tab.t, 'stage tab top inside its card').toBeGreaterThanOrEqual(card.t - 0.5)
      expect(tab.r, 'stage tab right inside its card').toBeLessThanOrEqual(card.r + 0.5)
    }
    expect(m.bottoms.length).toBeGreaterThan(0)
    for (const b of m.bottoms) expect(b, 'hand card bottom').toBeLessThanOrEqual(height - 4)
    expect(m.keys).toHaveLength(3)
    for (const k of m.keys) expect(k.b - k.t, 'drawer tab height').toBeGreaterThanOrEqual(44)
    // the map key drops clear of the drawer tabs
    if (m.mapKey) expect(m.mapKey.t, 'map key under the drawer tabs').toBeGreaterThanOrEqual(Math.max(...m.keys.map((k) => k.b)))
  })
}
