import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 190: the board at the table's scale. At the table sizes (1240x760 and up) tomorrow's papers are one
// ticker row (72 px or less with Pell's medallion; a long target wraps to a second line at 1280), so the cloth takes the height: the hexes fill 90%+ of its height
// and 57%+ of its width at 1440x900 (53.5% before), and Cath stands full length at its left edge, 300 px or more,
// meeting no hex, with Bea's drawing by her boots clear of both.
type Box = { x: number; y: number; width: number; height: number }
const meet = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('the board takes the table at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
  for (const [width, height, minW] of [[1440, 900, 0.57], [1280, 800, 0.53]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.table-cath').waitFor()
    const r = await page.evaluate(() => {
      const box = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } }
      const hexes = [...document.querySelectorAll('.region-hex polygon')].map(box).filter((b) => b.width > 0)
      const l = Math.min(...hexes.map((h) => h.x)), t = Math.min(...hexes.map((h) => h.y))
      const rr = Math.max(...hexes.map((h) => h.x + h.width)), bb = Math.max(...hexes.map((h) => h.y + h.height))
      const table = box(document.querySelector('.map-wrap')!)
      return {
        w: (rr - l) / table.width, h: (bb - t) / table.height, hexes, table,
        head: document.querySelector('.table-head')!.getBoundingClientRect().height,
        cath: box(document.querySelector('.table-cath-figure')!),
        bea: box(document.querySelector('.beas-drawing')!),
        scroll: document.documentElement.scrollHeight,
      }
    })
    const at = `${width}x${height}`
    expect(r.head, at).toBeLessThanOrEqual(72)
    expect(r.w, at).toBeGreaterThanOrEqual(minW)
    expect(r.h, at).toBeGreaterThanOrEqual(0.9)
    expect(r.cath.height, at).toBeGreaterThanOrEqual(width >= 1440 ? 300 : 290)
    expect(r.cath.x, at).toBeGreaterThanOrEqual(r.table.x)
    for (const h of r.hexes) {
      expect(meet(r.cath, h), `${at} Cath meets a hex`).toBe(false)
      expect(meet(r.bea, h), `${at} Bea's drawing meets a hex`).toBe(false)
    }
    expect(meet(r.bea, r.cath), at).toBe(false)
    expect(r.scroll, at).toBeLessThanOrEqual(height)
  }
})
