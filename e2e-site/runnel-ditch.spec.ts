import { expect, test } from '@playwright/test'

// Plan item 178: a ditch runs from the board's outlet to Bea's garden, meeting no tile; on a solve the water runs it
// and the garden turns watered within 1.2 s.
test('the water runs a ditch to Bea\'s garden on a solve', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(400)
  const garden = page.locator('.bea-garden')
  await expect(garden).toHaveAttribute('data-garden', 'dry')
  const ditch = page.locator('#runnel-ditch .runnel-ditch')
  await expect(page.locator('#runnel-ditch')).not.toHaveAttribute('hidden', '')
  const meets = await page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>('#runnel-ditch .runnel-ditch')!
    const deco = document.querySelector('.farm-deco')!.getBoundingClientRect()
    const board = document.getElementById('board') as unknown as SVGSVGElement
    const pt = board.createSVGPoint()
    const len = path.getTotalLength()
    const start = path.getPointAtLength(0)
    let hit = false
    for (let l = 0; l <= len && !hit; l += 4) {
      const p = path.getPointAtLength(l)
      if (Math.hypot(p.x - start.x, p.y - start.y) < 12) continue
      for (const t of document.querySelectorAll<SVGPolygonElement>('#board polygon.tile')) {
        pt.x = deco.left + p.x
        pt.y = deco.top + p.y
        if (t.isPointInFill(pt.matrixTransform(t.getScreenCTM()!.inverse()))) hit = true
      }
    }
    const end = path.getPointAtLength(len)
    const g = document.getElementById('bea-crops')!.getBoundingClientRect()
    return { hit, near: Math.hypot(Math.max(g.left - (deco.left + end.x), 0, deco.left + end.x - g.right), Math.max(g.top - (deco.top + end.y), 0, deco.top + end.y - g.bottom)) }
  })
  expect(meets.hit).toBe(false)
  expect(meets.near).toBeLessThanOrEqual(8)
  await expect(ditch).toBeAttached()
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  const t0 = Date.now()
  await expect(garden).toHaveAttribute('data-garden', 'watered', { timeout: 1_500 })
  expect(Date.now() - t0).toBeLessThanOrEqual(1_300)
  await expect(page.locator('#runnel-ditch')).toHaveAttribute('data-full', '')
})
