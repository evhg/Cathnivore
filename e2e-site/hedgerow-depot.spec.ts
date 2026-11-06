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

// Plan item 160: the depot never hides its gate's town sign (level 34's second gate showed only '…WELL'), and its
// board's words fit inside the board at P and D.
test('the depot keeps clear of the gate sign and its board fits', async ({ page }) => {
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  await expect(page.locator('[data-depot]').first()).toBeAttached()
  const boards = await page.locator('.depot-board').evaluateAll((els) => els.map((e) => ({ sw: e.scrollWidth, cw: e.clientWidth })))
  for (const b of boards) expect(b.sw).toBeLessThanOrEqual(b.cw + 1)
  // Plan item 201: the rep stands along the rail, clear of the board's end (his shoulder sat on it).
  const gaps = await page.locator('.depot:not(.depot-3d)').evaluateAll((els) =>
    els.map((d) => {
      const b = d.querySelector('.depot-board')!.getBoundingClientRect()
      const r = d.querySelector('.depot-rep')!.getBoundingClientRect()
      return r.left - b.right
    }),
  )
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(0)
  // The sign is painted on the canvas: sample its teal plate (#1f8a8a, about rgb(41,128,124) under the act's grade), then check no depot box
  // covers any of those pixels.
  const covered = await page.evaluate(() => {
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const sx = canvas.width / rect.width
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const depots = [...document.querySelectorAll('[data-depot]')].map((d) => d.getBoundingClientRect())
    let n = 0
    for (let y = 0; y < canvas.height; y += 2)
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4
        if (Math.abs(img[i]! - 41) > 10 || Math.abs(img[i + 1]! - 128) > 10 || Math.abs(img[i + 2]! - 124) > 10) continue
        const cx = rect.left + x / sx, cy = rect.top + y / sx
        if (depots.some((d) => cx > d.left && cx < d.right && cy > d.top && cy < d.bottom)) n++
      }
    return n
  })
  expect(covered).toBe(0)
})
