import { expect, test } from '@playwright/test'

// Plan item 648: the slate names the collection, not one game (the first poster is Cathnivore, the brand rides the
// kicker), on one line inside its column; at 1440x900 the stall's back is dressed with Bea's drawings and a shelf of
// preserves, each clear of Cath, the slate and today's pick.
test('the slate names the collection and the stall\'s back is dressed', async ({ page }) => {
  await page.goto('/games/')
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toHaveAccessibleName('Games from Marrow')
  for (const game of ['Cathnivore', 'Runnel', 'Hedgerow', 'NIGHT SHIFT']) await expect(h1).not.toHaveAccessibleName(game)
  // the booth is drawn round Cath and the words once their entrance has settled
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const t = document.querySelector('.hero .title-text')!.getBoundingClientRect()
    const col = document.querySelector('.hero-text')!.getBoundingClientRect()
    const box = (e: Element | null) => e?.getBoundingClientRect() ?? null
    return {
      title: { h: t.height, l: t.left, r: t.right },
      col: { l: col.left, r: col.right },
      vw: innerWidth,
      drawings: [...document.querySelectorAll('.hero-booth .bea-drawing')].map((e) => e.getBoundingClientRect().toJSON()),
      cath: box(document.querySelector('#hero-cath svg'))?.toJSON(),
      slate: box(document.querySelector('.hero-text'))?.toJSON(),
      pick: box(document.querySelector('.stall-wares'))?.toJSON(),
    }
  })
  // one line, inside the page (and inside the slate's column at D)
  expect(m.title.l).toBeGreaterThanOrEqual(0)
  expect(m.title.r).toBeLessThanOrEqual(m.vw)
  if (m.vw >= 1200) expect(m.title.r).toBeLessThanOrEqual(m.col.r + 1)
  if (m.vw === 1440) {
    expect(m.drawings.length).toBeGreaterThanOrEqual(3)
    const meets = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    for (const d of m.drawings) {
      // Cath's svg box is wider than her figure; the drawings hang beside it, never across her middle
      const c = m.cath as DOMRect
      expect(d.right <= c.left + c.width * 0.25 || d.left >= c.right - c.width * 0.25, 'a drawing over Cath').toBe(true)
      expect(meets(d, m.slate as DOMRect), 'a drawing on the slate').toBe(false)
      if (m.pick) expect(meets(d, m.pick as DOMRect), 'a drawing on today\'s pick').toBe(false)
    }
  }
})
