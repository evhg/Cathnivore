import { expect, test } from '@playwright/test'

// Plan item 30: a crisp board. At 1440 the board takes the middle of the farm (55% of the width or more), with the
// numbers in a rail beside it; the stats sheet is a grid whose tiles never overlap the 28-day calendar.

test.describe('Runnel board and stats sheet (plan item 30)', () => {
  test('at 1440 the board is at least 55% of the width, with the stats rail beside it', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'a desktop layout')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    const width = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#board .tile')].map((t) => t.getBoundingClientRect())
      return Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left))
    })
    expect(width / 1440).toBeGreaterThanOrEqual(0.55)
    await expect(page.locator('#rail')).toBeVisible()
    await expect(page.locator('#rail-figures > div')).toHaveCount(3)
    await expect(page.locator('#rail-cal > i')).toHaveCount(28)
    await page.locator('#btn-rail-stats').click()
    await expect(page.locator('#dlg-stats')).toBeVisible()
  })

  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`the stats sheet's tiles sit in two rows of three, clear of the calendar (${size.width})`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/runnel/?nohelp')
      await page.locator('#btn-stats').click()
      await expect(page.locator('#dlg-stats')).toBeVisible()
      const r = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll('#stat-grid > div')].map((d) => d.getBoundingClientRect())
        const cal = document.querySelector('#streak-cal')!.getBoundingClientRect()
        const rows = [...new Set(tiles.map((t) => Math.round(t.top)))]
        const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
        const pairs = tiles.flatMap((a, i) => tiles.slice(i + 1).filter((b) => overlap(a, b)))
        return { n: tiles.length, rows: rows.length, onCal: tiles.filter((t) => overlap(t, cal)).length, pairs: pairs.length }
      })
      expect(r).toEqual({ n: 6, rows: 2, onCal: 0, pairs: 0 })
    })
  }
})
