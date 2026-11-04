import { expect, test, type Page } from '@playwright/test'

// Plan item 122: one Cath. At D the valley figure speaks: her line is a bubble beside her head (15 px or more,
// meeting no tile) with its tail ending within 24 px of her face, and the side portrait goes. On a board with no
// room beside her the line stays in the sidebar without the portrait. Her face follows the water: worried on a
// spill, a wink on the solve. (The phone keeps its framed bust for now: a later slice of the item.)

const visibleCaths = (page: Page) =>
  page.evaluate(() =>
    ['host-face', 'valley-cath'].filter((id) => {
      const el = document.getElementById(id)!
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).display === 'none' || !el.querySelector('svg')) return false
      // Seen, not just laid out: the sidebar's visually hidden host clips its portrait away.
      for (let a: Element | null = el; a; a = a.parentElement) if (getComputedStyle(a).clipPath.startsWith('inset')) return false
      return true
    }),
  )

for (const date of ['2026-11-03', '2026-11-04', '2026-11-08']) {
  test(`one Cath at D, speaking from the valley (${date})`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the phone keeps its framed bust (a later slice)')
    await page.clock.setFixedTime(new Date(`${date}T10:00:00Z`))
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await expect.poll(() => visibleCaths(page)).toHaveLength(1)
    const say = page.locator('#valley-say')
    if (!(await say.isVisible())) {
      // No room on this board: the sidebar line, without the portrait.
      await expect(page.locator('.app')).toHaveAttribute('data-valley-say', 'side')
      return
    }
    expect(await visibleCaths(page)).toEqual(['valley-cath'])
    const m = await page.evaluate(() => {
      const s = document.getElementById('valley-say')!
      const cs = getComputedStyle(s)
      const tail = getComputedStyle(s, '::after')
      const r = s.getBoundingClientRect()
      const f = document.getElementById('valley-cath')!.getBoundingClientRect()
      const face = { l: f.left + f.width * 0.3, r: f.left + f.width * 0.7, t: f.top + f.height * 0.1, b: f.top + f.height * 0.42 }
      const a = parseFloat(cs.getPropertyValue('--tail-a'))
      const len = parseFloat(tail.width)
      const ex = r.left + parseFloat(tail.left) + Math.cos(a) * len
      const ey = r.top + parseFloat(tail.top) + Math.sin(a) * len
      const dist = Math.hypot(Math.max(face.l - ex, ex - face.r, 0), Math.max(face.t - ey, ey - face.b, 0))
      // Any tile under the bubble's own box?
      let onTile = false
      for (let x = r.left + 1; x < r.right; x += 6) {
        for (let y = r.top + 1; y < r.bottom; y += 6) {
          if (document.elementsFromPoint(x, y).some((e) => e.matches('#board polygon.tile'))) onTile = true
        }
      }
      return { font: parseFloat(cs.fontSize), dist, onTile, text: s.textContent }
    })
    expect(m.font).toBeGreaterThanOrEqual(15)
    expect(m.dist).toBeLessThanOrEqual(24)
    expect(m.onTile).toBe(false)
    expect(m.text).toBe(await page.locator('#host-line').textContent())
  })
}

test('her face follows the water: worried on a spill, a wink on the solve', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the valley figure is a full-length Cath at D')
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp&shotsolve')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const cath = page.locator('#valley-cath')
  // Turning a joined channel out of line spills the water.
  const tile = page.locator('.tiles > g.cell:not(.stone):not(.fixed):not([data-last])').nth(2)
  await tile.click()
  await expect(cath).toHaveAttribute('data-expression', 'worried')
  for (let k = 0; k < 5; k++) await tile.click()
  await page.locator('[data-last]').click()
  await expect(cath).toHaveAttribute('data-expression', 'wink')
})
