import { expect, test } from '@playwright/test'

// Plan item 157: Hollowell's depot by the gate (2D). It stands in the margin by its lane's start, 2 x 2 cells or
// larger and on no plot; its departures board carries the next round's count (no 'N coming' pill there); the rep
// on its balcony is smug, gleeful after a round that leaked and rattled after a clean one.
type G = { wave: number; phase: string; leaks?: number; level: { cols: number; rows: number; path: number[][] } }
type W = { hedgerow?: { game: () => G | null; cellCenter: (c: number, r: number) => { x: number; y: number } | null; gateQueue: () => { plates: unknown[] } | null } }

test('the depot stands by the gate with the next round on its board, and the rep reacts to the round', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'level 21 has no margin for a depot on a phone')
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const depot = page.locator('[data-depot]').first()
  await expect(depot).toBeAttached()
  await expect(depot).toHaveAttribute('data-rep-mood', 'smug')
  const m = await page.evaluate(() => {
    const hg = (window as unknown as W).hedgerow!
    const g = hg.game()!
    const a = hg.cellCenter(0, 0)!, b = hg.cellCenter(1, 1)!
    const cell = b.x - a.x
    const d = document.querySelector('[data-depot]')!.getBoundingClientRect()
    const gate = hg.cellCenter(g.level.path[0]![0]!, g.level.path[0]![1]!)!
    const fL = a.x - cell / 2, fT = a.y - cell / 2, fR = fL + g.level.cols * cell, fB = fT + g.level.rows * cell
    const gap = Math.max(0, Math.max(d.left - gate.x, gate.x - d.right) - cell / 2, Math.max(d.top - gate.y, gate.y - d.bottom) - cell / 2)
    return {
      cells: d.width / cell,
      gap,
      onField: d.left < fR && d.right > fL && d.top < fB && d.bottom > fT,
      count: Number(document.querySelector('[data-depot] [data-depot-count]')!.getAttribute('data-depot-count')),
      pills: hg.gateQueue()?.plates.length ?? 0,
    }
  })
  expect(m.cells).toBeGreaterThanOrEqual(2)
  expect(m.gap).toBeLessThanOrEqual(60)
  expect(m.onField).toBe(false)
  expect(m.count).toBeGreaterThan(0)
  expect(m.pills).toBe(0)
  // A round that ends clean rattles him; one with a leak delights him.
  // The next round's number with or without a leak on the way (the field stays between rounds).
  const round = async (leak: boolean) =>
    page.evaluate((leak) => {
      const g = (window as unknown as W).hedgerow!.game()!
      if (leak) g.leaks = (g.leaks ?? 0) + 1
      g.wave += 1
    }, leak)
  await round(false)
  await expect(depot).toHaveAttribute('data-rep-mood', 'rattled')
  await round(true)
  await expect(depot).toHaveAttribute('data-rep-mood', 'gleeful')
  // Go: the roller door rolls up as the convoy pulls out.
  await expect(depot).not.toHaveAttribute('data-door-open', '')
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game: () => unknown; sendWave: (g: unknown, f?: boolean) => void } }).hedgerow
    hg.sendWave(hg.game(), true)
  })
  await expect(page.locator('[data-depot]').first()).toHaveAttribute('data-door-open', '')
})
