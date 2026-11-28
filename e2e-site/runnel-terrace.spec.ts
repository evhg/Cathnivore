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
        // the gap to the lip's outline (its edges, not just their corners: the branch may end mid-edge)
        const pts = [...t.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(m))
        pts.forEach((a, i) => {
          const b = pts[(i + 1) % pts.length]!
          const [dx, dy] = [b.x - a.x, b.y - a.y]
          const k = Math.max(0, Math.min(1, ((end[0]! - a.x) * dx + (end[1]! - a.y) * dy) / (dx * dx + dy * dy || 1)))
          lipGap = Math.min(lipGap, Math.hypot(a.x + dx * k - end[0]!, a.y + dy * k - end[1]!))
        })
      }
    }
    // Plan item 259: the culvert is never tucked against the spring house's tag (it hid the branch there).
    const sign = document.querySelector('.spring-sign')!.getBoundingClientRect()
    const bySign = !!end && end[0]! > sign.left - 14 && end[0]! < sign.right + 14 && end[1]! > sign.top - 14 && end[1]! < sign.bottom + 14
    // Plan item 748: the feed visibly arrives at the spring: its tile's inlet pipe is shown and faces the culvert
    // (within half a corner step, 30 degrees, of the culvert's bearing from the spring).
    const inlet = document.querySelector<SVGGElement>('.tiles > g.cell.spring .spring-inlet')
    const well = document.querySelector('.tiles > g.cell.spring .well-ring')?.getBoundingClientRect()
    const mouth = inlet?.querySelector('.inlet-mouth')?.getBoundingClientRect()
    let inletOff = 180
    if (end && well && mouth) {
      const [wx, wy] = [well.x + well.width / 2, well.y + well.height / 2]
      const a = Math.atan2(mouth.y + mouth.height / 2 - wy, mouth.x + mouth.width / 2 - wx)
      const b = Math.atan2(end[1]! - wy, end[0]! - wx)
      inletOff = Math.abs((((a - b) * 180) / Math.PI + 540) % 360 - 180)
    }
    return { onValley, n, hidden: feeder?.hasAttribute('hidden') ?? true, lipGap, bySign, inletOn: !!inlet?.dataset.on, mouthW: mouth?.width ?? 0, inletOff }
  })
  expect(r.n).toBeGreaterThan(20)
  expect(r.onValley).toBe(0)
  expect(r.hidden).toBe(false)
  expect(r.lipGap).toBeLessThanOrEqual(12)
  expect(r.bySign).toBe(false)
  expect(r.inletOn).toBe(true)
  expect(r.mouthW).toBeGreaterThan(6)
  expect(r.inletOff).toBeLessThanOrEqual(31)
})
