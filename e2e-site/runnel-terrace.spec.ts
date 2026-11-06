import { expect, test } from '@playwright/test'

// Plan item 186: the board is dug into the valley: a terrace ([data-terrace]) follows its outline, so the valley's
// hedges and furrows stop at its edge (a point just outside each tile hits the terrace, not the valley), and the
// spring-house stream's branch ends at the terrace's lip.
test('the board sits in a terrace, fed by the stream', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(600)
  await expect(page.locator('#board [data-terrace]')).toBeAttached()
  const r = await page.evaluate(() => {
    const valley = document.querySelector('.valley')!
    let onValley = 0
    let n = 0
    for (const t of document.querySelectorAll<SVGPolygonElement>('#board polygon.tile')) {
      const m = t.getScreenCTM()!
      const pts = [...t.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(m))
      const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length
      const cy = pts.reduce((a, q) => a + q.y, 0) / pts.length
      for (const q of pts) {
        const d = Math.hypot(q.x - cx, q.y - cy)
        const x = q.x + ((q.x - cx) / d) * 8
        const y = q.y + ((q.y - cy) / d) * 8
        const hit = document.elementFromPoint(x, y)
        if (!hit) continue
        n++
        if (valley.contains(hit)) onValley++
      }
    }
    const feeder = document.getElementById('runnel-feeder')
    const end = feeder?.dataset.end?.split(',').map(Number)
    let lipGap = Infinity
    if (end) {
      for (const t of document.querySelectorAll<SVGPolygonElement>('#board .terrace-lip polygon')) {
        const m = t.getScreenCTM()!
        for (const q of [...t.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(m))) lipGap = Math.min(lipGap, Math.hypot(q.x - end[0]!, q.y - end[1]!))
      }
    }
    return { onValley, n, hidden: feeder?.hasAttribute('hidden') ?? true, lipGap }
  })
  expect(r.n).toBeGreaterThan(20)
  expect(r.onValley).toBe(0)
  expect(r.hidden).toBe(false)
  expect(r.lipGap).toBeLessThanOrEqual(12)
})
