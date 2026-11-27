import { expect, test } from '@playwright/test'

// Plan item 736: on level 34's late field (2D, the sandbox, twelve towers along the lanes and eight rounds sent),
// every "+N" gain and text float stands 12 px inside the field, no two of them meet, at most 6 are live, and no
// vehicle on the road is left under a tower's sprite (l34's lorries passed under the hedge and the duck pond).
type R = { x: number; y: number; w: number; h: number }
type HG = {
  game(): { level: { path: number[][]; path2?: number[][]; rows: number; cols: number; towers: string[] }; wave: number }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  arm?(g: unknown): void
  sendWave(g: unknown, forced?: boolean): void
  renderer(): { gainRects(): R[]; floatRects(): R[]; redrawn: number; underSprite: number }
}

test('level 34 late wave: the numbers stay apart and inside, the convoy over the towers', async ({ page }) => {
  test.setTimeout(180_000)
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 34: true }, seen: {}, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&2d&level=34')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const path = [...g.level.path, ...(g.level.path2 ?? [])]
    const near = (c: number, r: number) => Math.min(...path.map(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r)))
    const spots: number[][] = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
    spots.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
    let n = 0
    for (const [, c, r] of spots) {
      if (n >= 12) break
      if (h.place(g, g.level.towers[n % g.level.towers.length]!, c!, r!).ok) n++
    }
    h.arm?.(g)
    for (let i = 0; i < 8; i++) h.sendWave(g, true)
  })
  const M = 12
  const meet = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  let labels = 0
  let redrawn = 0
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500)
    const f = await page.evaluate(() => {
      const r = (window as unknown as { hedgerow: HG }).hedgerow.renderer()
      const c = document.getElementById('canvas')!.getBoundingClientRect()
      return { w: c.width, h: c.height, all: [...r.gainRects(), ...r.floatRects()], redrawn: r.redrawn, under: r.underSprite }
    })
    labels += f.all.length
    redrawn = Math.max(redrawn, f.redrawn)
    expect(f.under, 'a vehicle left under a tower sprite').toBe(0)
    expect(f.all.length).toBeLessThanOrEqual(6)
    for (const [k, a] of f.all.entries()) {
      expect(a.x, 'inside the left edge').toBeGreaterThanOrEqual(M - 0.5)
      expect(a.y, 'inside the top edge').toBeGreaterThanOrEqual(M - 0.5)
      expect(a.x + a.w, 'inside the right edge').toBeLessThanOrEqual(f.w - M + 0.5)
      expect(a.y + a.h, 'inside the foot').toBeLessThanOrEqual(f.h - M + 0.5)
      for (const b of f.all.slice(k + 1)) expect(meet(a, b), `${JSON.stringify(a)} meets ${JSON.stringify(b)}`).toBe(false)
    }
  }
  expect(labels, 'the late field pays').toBeGreaterThan(10)
  expect(redrawn, 'some vehicle passed a tower sprite').toBeGreaterThan(0)
})
