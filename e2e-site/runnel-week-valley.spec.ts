import { expect, test, type Page } from '@playwright/test'

// Plan item 142: the valley keeps the week. Each daily solved since Monday stands as a feature in the valley (a missed
// day leaves a fallow plot), none meeting a tile; a new week starts the valley afresh; the board doesn't move.
const r = (n: number) => ({ number: n, timeMs: 90_000, taps: 30, par: 30 })
const SAVE = { version: 1, daily: {}, practice: {}, results: { '2026-11-02': r(37), '2026-11-03': r(38), '2026-11-04': r(39) }, bestPractice: {}, practiceSolved: 0, seenHelp: true }

const open = async (page: Page, at: string) => {
  await page.clock.setFixedTime(new Date(at))
  await page.goto('/runnel/?nohelp')
  await page.evaluate((s) => localStorage.setItem('runnel:v1', JSON.stringify(s)), SAVE)
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  await page.waitForTimeout(300)
}

test('three dailies solved this week stand in the valley, clear of the tiles', async ({ page }) => {
  await open(page, '2026-11-05T10:00:00Z')
  const shown = page.locator('[data-valley-feature]:not([hidden])')
  await expect(shown).toHaveCount(3)
  expect(await page.locator('[data-valley-feature="fallow"]').count()).toBe(0)
  const clash = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect())
    return [...document.querySelectorAll<HTMLElement>('[data-valley-feature]:not([hidden])')].some((f) => {
      const b = f.getBoundingClientRect()
      return tiles.some((t) => t.left < b.right && b.left < t.right && t.top < b.bottom && b.top < t.bottom)
    })
  })
  expect(clash).toBe(false)
  // The board doesn't move for them.
  const board = await page.locator('#board').boundingBox()
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(200)
  const again = await page.locator('#board').boundingBox()
  expect(Math.abs(again!.x - board!.x) + Math.abs(again!.y - board!.y)).toBeLessThanOrEqual(2)
})

test('a new week starts the valley afresh', async ({ page }) => {
  await open(page, '2026-11-09T10:00:00Z')
  await expect(page.locator('[data-valley-feature]')).toHaveCount(0)
})
