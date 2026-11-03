import { test, expect } from '@playwright/test'

// Plan item 55: each region's landmark stands on its tile, inside the hex and clear of every piece, through an
// autoplayed game's later rounds (the same bounding check as board-scales).
test('landmarks stand inside their hexes, clear of the pieces', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  let checked = 0
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline && checked < 3) {
    const report = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')
      if (!svg) return null
      const round = Number(svg.dataset.round)
      const out: string[] = []
      let landmarks = 0
      let hidden = 0
      for (const hex of Array.from(svg.querySelectorAll<SVGGElement>('.region-hex'))) {
        const name = hex.getAttribute('aria-label')
        const lm = hex.querySelector<SVGGElement>('.board-landmark')
        if (!lm) {
          out.push(`${name}: no landmark`)
          continue
        }
        // A tile too crowded for one stands its landmark aside for now (placeLandmarks hides it).
        if (lm.getAttribute('visibility') === 'hidden') {
          hidden++
          continue
        }
        landmarks++
        const poly = hex.querySelector('polygon')!
        const ctm = poly.getScreenCTM()!
        const pts = Array.from(poly.points).map((p) => new DOMPoint(p.x, p.y).matrixTransform(ctm))
        const inside = (x: number, y: number) => {
          let c = false
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i]!, b = pts[j]!
            if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
          }
          return c
        }
        const l = lm.getBoundingClientRect()
        if (![[l.left, l.top], [l.right, l.top], [l.left, l.bottom], [l.right, l.bottom]].every(([x, y]) => inside(x!, y!))) out.push(`${name}: landmark outside`)
        for (const el of Array.from(hex.querySelectorAll<SVGGElement>('[data-piece]'))) {
          const r = el.getBoundingClientRect()
          if (r.left < l.right && l.left < r.right && r.top < l.bottom && l.top < r.bottom) out.push(`${name}: landmark over ${el.dataset.piece}`)
        }
      }
      return { round, out, landmarks, hidden }
    })
    if (report && report.round >= 6) {
      expect(report.out, `round ${report.round}`).toEqual([])
      // Most tiles keep theirs even late in a game.
      expect(report.landmarks, `round ${report.round}: ${report.hidden} stood aside`).toBeGreaterThanOrEqual(report.hidden)
      checked++
    }
    if (await page.locator('.end-screen').isVisible()) break
    await page.waitForTimeout(150)
  }
  expect(checked, 'never saw a round-6+ board').toBeGreaterThan(0)
})
