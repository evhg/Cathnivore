import { test, expect } from '@playwright/test'

// Plan item 2 (a board that scales): once an autoplayed game reaches round 6 or later, every piece on the
// map (stacked enemy pieces and producer stalls) still sits inside its own hex, and stalls are big enough
// to read on a phone (at least 24 px tall at 390 px wide). The end screen's small summary map is not checked.
test('late-game pieces stay inside their hexes', async ({ page }, testInfo) => {
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()

  let checked = 0
  let maxRound = 0
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline && checked < 3) {
    const report = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')
      if (!svg) return null
      const round = Number(svg.dataset.round)
      const out: string[] = []
      let pieces = 0
      let stallH = Infinity
      for (const hex of Array.from(svg.querySelectorAll<SVGGElement>('.region-hex'))) {
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
        for (const el of Array.from(hex.querySelectorAll<SVGGElement>('[data-piece]'))) {
          pieces++
          const r = el.getBoundingClientRect()
          if (el.dataset.piece === 'stall') stallH = Math.min(stallH, r.height)
          const corners: [number, number][] = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]
          if (!corners.every(([x, y]) => inside(x, y))) out.push(`${hex.getAttribute('aria-label')} ${el.dataset.piece}`)
        }
      }
      return { round, out, pieces, stallH }
    })
    if (report && report.round >= 6) {
      expect(report.out, `round ${report.round}`).toEqual([])
      if (testInfo.project.name === 'phone' && report.stallH !== Infinity) expect(report.stallH).toBeGreaterThanOrEqual(24)
      checked++
      maxRound = Math.max(maxRound, report.round)
    }
    if (await page.locator('.end-screen').isVisible()) break
    await page.waitForTimeout(150)
  }
  expect(checked, 'never saw a round-6+ board (game ended early?)').toBeGreaterThan(0)
  expect(maxRound).toBeGreaterThanOrEqual(6)
})
