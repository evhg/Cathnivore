import { expect, test } from '@playwright/test'

// Plan item 179: in 3D Hollowell's depot reads at a glance: one white shed per lane, as in 2D, standing in the frame
// beside its gate, clear of Cath, her line and the field's cells, the next round's count hung on its teal fascia
// (14 px type or more), and its shutter rolls up as a round leaves.
type Box = { x: number; y: number; w: number; h: number }
type HG = {
  game(): { level: { path2?: unknown } } | null
  depots3d(): Box[]
  depotShutter3d(): number | null
  cathBox(): Box | null
  plotBoxes(): Box[]
  camSettled(): boolean
  sendWave(g: unknown, force?: boolean): void
}
const meet = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

for (const level of [21, 34]) {
  test(`the 3D depot stands in frame with the count on its fascia (level ${level})`, async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.camSettled()), { timeout: 60_000 }).toBe(true)
    const plate = page.locator('.gate-plate[data-on-depot]').first()
    await expect(plate).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HG }).hedgerow
      const c = document.getElementById('canvas')!.getBoundingClientRect()
      const say = document.getElementById('cath-say')
      const sb = say && getComputedStyle(say).display !== 'none' && !say.hidden ? say.getBoundingClientRect() : null
      return {
        lanes: h.game()!.level.path2 ? 2 : 1,
        canvas: { x: c.left, y: c.top, w: c.width, h: c.height },
        depots: h.depots3d().map((d) => ({ ...d, x: d.x + c.left, y: d.y + c.top })),
        cath: h.cathBox(),
        say: sb && sb.width > 0 ? { x: sb.left, y: sb.top, w: sb.width, h: sb.height } : null,
        plots: h.plotBoxes(),
        font: parseFloat(getComputedStyle(document.querySelector('.gate-plate[data-on-depot]')!).fontSize),
        plate: (() => { const b = document.querySelector('.gate-plate[data-on-depot]')!.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } })(),
      }
    })
    // One depot a lane: the 2D field draws one by each gate wherever its margin has room (both lanes at D).
    expect(r.depots.length).toBe(r.lanes)
    expect(r.font).toBeGreaterThanOrEqual(14)
    // The lane-1 depot (the first gate) is the one the count hangs on: whole enough in the frame, wide, and clear.
    const d = r.depots[0]!
    const inFrame = meet(d, r.canvas) / (d.w * d.h)
    // A phone's high camera puts the north verge at the frame's top edge: there the roof's ridge may be cut.
    expect(inFrame).toBeGreaterThan(hasTouch ? 0.65 : 0.85)
    if (!hasTouch) expect(d.w).toBeGreaterThanOrEqual(90)
    // Plan item 194: a depot cut by the frame's top shows only its face; the plate hangs under its door, not on it.
    if (d.y < r.canvas.y) {
      const seen = { x: d.x, y: r.canvas.y, w: d.w, h: d.y + d.h - r.canvas.y }
      expect(meet(r.plate, seen) / (seen.w * seen.h)).toBeLessThan(0.05)
    }
    for (const dep of r.depots) {
      if (r.cath) expect(meet(dep, r.cath)).toBe(0)
      if (r.say) expect(meet(dep, r.say)).toBe(0)
      // The box is the shed's loose 3D bounds (roof overhang, bay and floodlight); its corners may graze a cell.
      const onField = r.plots.reduce((a, p) => a + meet(dep, p), 0) / (dep.w * dep.h)
      expect(onField).toBeLessThan(0.12)
    }
    // Go: the shutter rolls up as the convoy leaves.
    expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.depotShutter3d())).toBe(0)
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HG }).hedgerow
      h.sendWave(h.game(), true)
    })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.depotShutter3d()), { timeout: 30_000 }).toBeGreaterThan(0.5)
  })
}
