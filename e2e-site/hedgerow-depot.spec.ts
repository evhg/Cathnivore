import { expect, test } from '@playwright/test'

// Plan item 157: Hollowell's depot by the gate (2D). It stands in the margin by its lane's start, 2 x 2 cells or
// larger and on no plot; its departures board carries the next round's count (no 'N coming' pill there); the rep
// on its balcony is smug, gleeful after a round that leaked and rattled after a clean one.
type G = { wave: number; phase: string; leaks?: number; level: { cols: number; rows: number; path: number[][] } }
type W = { hedgerow?: { depotDoors?: () => string; sendWave?: (g: unknown, b: boolean) => void; game: () => G | null; cellCenter: (c: number, r: number) => { x: number; y: number } | null; gateQueue: () => { plates: unknown[] } | null } }

test('the depot stands by the gate with the next round on its board, and the rep reacts to the round', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the phone field leaves no dry margin for a full depot')
  // Plan item 380: level 34's first gate is on dry ground (level 21's sea-side depot is a jetty, item 391's case below).
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
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

// Plan item 391: a gate that faces the sea gets its depot as a jetty warehouse on piles, inside the field canvas, with
// the count on its board (no bare gate sign and no floating 'N coming' pill).
test('a sea-side gate has its depot on a jetty, whole inside the canvas', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the phone field leaves no margin for a full depot (item 391 slice 2)')
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const depot = page.locator('[data-depot][data-jetty]').first()
  await expect(depot).toBeAttached()
  await expect(depot.locator('.depot-jetty')).toBeAttached()
  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect()
    const d = document.querySelector('[data-depot]')!.getBoundingClientRect()
    const plates = (window as unknown as W).hedgerow!.gateQueue()?.plates.length ?? 0
    return { inside: d.left >= c.left && d.right <= c.right && d.top >= c.top && d.bottom <= c.bottom, plates }
  })
  expect(m.inside).toBe(true)
  expect(m.plates).toBe(0)  // The doors roll up as a round's convoy leaves.
  expect(await page.evaluate(() => (window as unknown as W).hedgerow!.depotDoors!())).toBe('shut')
  await page.evaluate(() => {
    const h = (window as unknown as W).hedgerow!
    h.sendWave!(h.game(), true)
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as W).hedgerow!.depotDoors!()), { timeout: 20_000 }).toBe('open')
})

// Plan item 391: an upright phone's l21 has no margin at all (the field runs edge to edge), so its depot stands small
// on the lane's mouth: inside the canvas, on no plot, the count on its board and no floating pill.
// Every level's first gate has its depot at P and D (levels 1, 21, 34, 40).
for (const level of [1, 21, 34, 40]) test(`level ${level}'s gate has its depot inside the canvas, on no plot`, async ({ page }) => {
  await page.goto(`/hedgerow/?2d&sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  await expect(page.locator('[data-depot]').first()).toBeAttached()
  const m = await page.evaluate(() => {
    const hg = (window as unknown as W).hedgerow!
    const g = hg.game()!
    const a = hg.cellCenter(0, 0)!, b = hg.cellCenter(1, 1)!
    const cell = b.x - a.x
    const lane = new Set<string>()
    const p = g.level.path
    for (let k = 1; k < p.length; k++) {
      const [ac, ar] = p[k - 1]!, [bc, br] = p[k]!
      const n = Math.max(Math.abs(bc! - ac!), Math.abs(br! - ar!))
      for (let t = 0; t <= n; t++) lane.add(`${ac! + Math.sign(bc! - ac!) * t},${ar! + Math.sign(br! - ar!) * t}`)
    }
    const d = document.querySelector('[data-depot="0"]')!.getBoundingClientRect()
    const c = document.querySelector('canvas')!.getBoundingClientRect()
    let onPlot = 0
    for (let r = 0; r < g.level.rows; r++)
      for (let col = 0; col < g.level.cols; col++) {
        if (lane.has(`${col},${r}`)) continue
        const q = hg.cellCenter(col, r)!
        const w = Math.min(d.right, q.x + cell / 2) - Math.max(d.left, q.x - cell / 2)
        const h = Math.min(d.bottom, q.y + cell / 2) - Math.max(d.top, q.y - cell / 2)
        if (w > 6 && h > 6) onPlot++
      }
    return {
      inside: d.left >= c.left && d.right <= c.right && d.top >= c.top && d.bottom <= c.bottom,
      onPlot,
      count: Number(document.querySelector('[data-depot] [data-depot-count]')!.getAttribute('data-depot-count')),
      plates: hg.gateQueue()?.plates.length ?? 0,
    }
  })
  expect(m.inside).toBe(true)
  expect(m.onPlot).toBe(0)
  expect(m.count).toBeGreaterThan(0)
  expect(m.plates).toBe(0)
})

// Plan item 748: mid-round both boards read '0 next' (the count came from the next round only between rounds). During
// a round each board counts its lane's vehicles still to leave, ticking down, and goes dim once its last has left.
test("during a round the depot's board counts what is still to leave, not '0 next'", async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'level 34 has no margin for its depots on a phone')
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const boards = page.locator('[data-depot] .depot-board')
  await expect(boards.first()).toBeAttached()
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game: () => unknown; sendWave: (g: unknown, f?: boolean) => void } }).hedgerow
    hg.sendWave(hg.game(), true)
  })
  await expect.poll(async () => (await boards.allTextContents()).join('|'), { timeout: 10_000 }).toMatch(/to go/)
  const read = () =>
    page.evaluate(() => {
      const g = (window as unknown as { hedgerow: { game: () => { spawnQueue: Array<{ lane?: number }> } } }).hedgerow.game()
      return {
        texts: [...document.querySelectorAll('[data-depot] .depot-board')].map((b) => b.textContent),
        counts: [...document.querySelectorAll<HTMLElement>('[data-depot]')].map((d) => ({
          lane: Number(d.dataset.depot),
          n: Number(d.querySelector('[data-depot-count]')!.getAttribute('data-depot-count')),
          spent: d.hasAttribute('data-spent'),
        })),
        queue: [0, 1].map((l) => g.spawnQueue.filter((q) => (q.lane ?? 0) === l).length),
      }
    })
  const a = await read()
  for (const t of a.texts) expect(t).toMatch(/^\d+ to go$/)
  expect(a.counts.some((c) => c.n > 0)).toBe(true)
  // The board's number is the lane's queue (read in the same frame, give or take the one that just left).
  for (const c of a.counts) {
    expect(Math.abs(c.n - a.queue[c.lane]!)).toBeLessThanOrEqual(1)
    expect(c.spent).toBe(c.n === 0)
  }
  // The board still fits its box with the longer word.
  const fit = await boards.evaluateAll((els) => els.every((e) => e.scrollWidth <= e.clientWidth + 1))
  expect(fit).toBe(true)
})
