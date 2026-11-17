import { expect, test } from '@playwright/test'

// Plan item 466: a dry board shows which channels already meet. Every open edge is named (`data-open-edge`); where
// two neighbours' channels face each other a joined lip bridges their seam, sitting on that seam (half way between
// the two tiles); turning one of them away takes it off.
test('joined channels draw a lip across their seam, and a turn redraws it', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(600)
  expect(await page.locator('#board [data-open-edge]').count()).toBeGreaterThan(10)
  const joins = page.locator('#board .join')
  expect(await joins.count()).toBeGreaterThan(0)
  const seams = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<SVGGElement>('#board .tiles > g.cell')]
    const mid = (e: Element) => {
      const r = e.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    return [...document.querySelectorAll<SVGGElement>('#board .join')].map((j) => {
      const [a, b] = j.dataset.join!.split('-').map(Number) as [number, number]
      const tile = cells[a]!.querySelector('polygon.tile')!.getBoundingClientRect()
      const p = mid(j.querySelector('.join-lip')!)
      const ca = mid(cells[a]!.querySelector('polygon.tile')!)
      const cb = mid(cells[b]!.querySelector('polygon.tile')!)
      const half = Math.hypot(ca.x - cb.x, ca.y - cb.y) / 2
      return { a, b, da: Math.hypot(p.x - ca.x, p.y - ca.y) / half, db: Math.hypot(p.x - cb.x, p.y - cb.y) / half, w: tile.width }
    })
  })
  for (const s of seams) {
    expect(s.da, JSON.stringify(s)).toBeGreaterThan(0.85)
    expect(s.da, JSON.stringify(s)).toBeLessThan(1.15)
    expect(s.db, JSON.stringify(s)).toBeGreaterThan(0.85)
    expect(s.db, JSON.stringify(s)).toBeLessThan(1.15)
  }
  // Turn a turnable tile of a joined pair through a full circle: the joins are redrawn each turn (each still on a
  // seam), and six turns later they are the same set as before.
  const set = () => page.evaluate(() => [...document.querySelectorAll<SVGGElement>('#board .join')].map((j) => j.dataset.join).sort().join(' '))
  const original = await set()
  const pick = await page.evaluate((pairs) => {
    const cells = [...document.querySelectorAll<SVGGElement>('#board .tiles > g.cell')]
    for (const [a, b] of pairs) for (const i of [a, b]) if (!cells[i]!.classList.contains('fixed') && !cells[i]!.classList.contains('locked')) return i
    return -1
  }, seams.map((s) => [s.a, s.b]))
  expect(pick).toBeGreaterThanOrEqual(0)
  const cell = page.locator('#board .tiles > g.cell').nth(pick)
  const seen = new Set<string>()
  for (let k = 0; k < 6; k++) {
    await cell.click()
    await page.waitForTimeout(700)
    seen.add(await set())
    for (const key of (await set()).split(' ').filter(Boolean)) {
      const [a, b] = key.split('-').map(Number) as [number, number]
      // neighbours: a lip only ever joins two adjacent tiles
      const d = await page.evaluate(([a, b]) => {
        const cells = document.querySelectorAll<SVGGElement>('#board .tiles > g.cell polygon.tile')
        const r1 = cells[a]!.getBoundingClientRect()
        const r2 = cells[b]!.getBoundingClientRect()
        return Math.hypot(r1.x - r2.x, r1.y - r2.y) / r1.width
      }, [a, b])
      expect(d, key).toBeLessThan(1.1)
    }
  }
  expect(await set()).toBe(original)
  expect(seen.size, 'the lips change as the tile turns').toBeGreaterThan(1)
})
