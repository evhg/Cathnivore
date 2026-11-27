import { expect, test } from '@playwright/test'

// Plan item 734: the phone board is crisp and its channels legible at 390 wide. The board is vector (SVG, no raster
// canvas to blur at 3x), each channel draws 6 CSS px or wider, and a channel already joined to the spring carries its
// water (`data-wet`) before the puzzle is solved. Channel-on-tile contrast in every weather is runnel-tiles'.
test('the phone board is vector, its channels wide, a joined channel wet before the solve', async ({ page }, info) => {
  test.skip(info.project.name !== 'site-desktop', 'sets its own viewport; one run is enough')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00Z'))
  await page.goto('/runnel/?nohelp&sky=noon')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const r = await page.evaluate(() => {
    const board = document.querySelector('#board')!
    const g = board.querySelector<SVGGraphicsElement>('.groove')!
    const k = g.ownerSVGElement!.getScreenCTM()!.a
    return {
      canvases: board.querySelectorAll('canvas').length,
      groovePx: parseFloat(getComputedStyle(g).strokeWidth) * k,
      wet: board.querySelectorAll('.tiles > g.cell[data-wet]').length,
      solved: document.querySelector('.foot')?.hasAttribute('data-solved') ?? true,
    }
  })
  expect(r.canvases).toBe(0)
  expect(r.groovePx).toBeGreaterThanOrEqual(6)
  expect(r.solved).toBe(false)
  expect(r.wet).toBeGreaterThan(1)
})
