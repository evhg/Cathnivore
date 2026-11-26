import { expect, test } from '@playwright/test'

// Plan item 706: a battle you can read at a glance (2D). On levels 27 and 34, with eight towers beside the lane and a
// round under way, no swarm badge covers a vehicle or a tower (they dock off the lane, a leader line back to the
// queue), the gain numbers ("+N") stand 120 CSS px or more apart (gains near a live number join it) and are 14 px+.
type Rect = { x: number; y: number; w: number; h: number }
type Field = { gains: Array<Rect & { n: number; size: number }>; badges: Rect[]; vehicles: Rect[]; towers: Rect[] }
type HG = {
  game(): { level: { rows: number; cols: number; towers: string[]; path: number[][]; path2?: number[][] }; enemies: unknown[] }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  sendWave(g: unknown, force?: boolean): void
  arm?(g: unknown): void
  field2d(): Field | null
}
const over = (a: Rect, b: Rect) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1

for (const level of [27, 34])
  test(`level ${level}: badges off the vehicles and towers, gain numbers apart`, async ({ page }) => {
    test.setTimeout(240_000)
    const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l as number]: true }, tips: t })), [stars, tips, level] as const)
    await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.addStyleTag({ content: '#intro { display: none !important; }' })
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HG }).hedgerow
      const g = h.game()
      const path = [...g.level.path, ...(g.level.path2 ?? [])]
      const near = (c: number, r: number) => Math.min(...path.map(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r)))
      const cover = (c: number, r: number) => path.filter(([pc, pr]) => Math.hypot(pc! - c, pr! - r) <= 2.2).length
      const spots: Array<[number, number, number]> = []
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
      spots.sort((a, b) => Number(a[0] > 1) - Number(b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
      let n = 0
      for (const [, c, r] of spots) {
        if (n >= 8) break
        if (h.place(g, g.level.towers[n % g.level.towers.length]!, c, r).ok) n++
      }
      h.arm?.(g)
      h.sendWave(g, true)
    })
    const bad: string[] = []
    let badgesSeen = 0
    let gainsSeen = 0
    // Round start through mid-wave: a sample every 300 ms for 15 s, each from one drawn frame.
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(300)
      await page.evaluate(() => document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click())
      const f = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.field2d())
      if (!f) continue
      badgesSeen += f.badges.length
      gainsSeen += f.gains.length
      for (const b of f.badges) {
        if (f.vehicles.some((v) => over(b, v))) bad.push(`t${i} badge ${JSON.stringify(b)} on a vehicle`)
        if (f.towers.some((v) => over(b, v))) bad.push(`t${i} badge ${JSON.stringify(b)} on a tower`)
      }
      for (const g of f.gains) if (g.size < 14) bad.push(`t${i} gain +${g.n} at ${g.size}px`)
      for (let a = 0; a < f.gains.length; a++)
        for (let b = a + 1; b < f.gains.length; b++) {
          const A = f.gains[a]!, B = f.gains[b]!
          // centres where each first stood: compare the boxes' centres (both rise at the same rate as they fade)
          const d = Math.hypot(A.x + A.w / 2 - (B.x + B.w / 2), A.y + A.h / 2 - (B.y + B.h / 2))
          if (d < 110) bad.push(`t${i} +${A.n} and +${B.n} ${Math.round(d)} px apart`)
        }
    }
    await page.screenshot({ path: `e2e/screenshots/readable706/l${level}-${test.info().project.name}.png` })
    expect(gainsSeen, 'no gain numbers drawn').toBeGreaterThan(0)
    if (level === 34) expect(badgesSeen, 'no swarm badges drawn').toBeGreaterThan(0)
    expect(bad.slice(0, 12)).toEqual([])
  })
