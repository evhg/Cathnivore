import { expect, test } from '@playwright/test'

// Plan item 748: each 3D tower's pooled '+N' stands on the tower's drawn top, not 1.25 units up its body (the gold
// '+33' sat on the gold beehive and '+8' on the scarecrow's chest at l27, D and P). Checked against its own tower's
// screen box; a tall tower behind (the windmill's sails) may still stand under it.
type Box = { x: number; y: number; w: number; h: number }
type HG = {
  game(): { level: { rows: number; cols: number; towers: string[]; path?: number[][]; path2?: number[][] } }
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  arm?(g: unknown): void
  sendWave(g: unknown, f?: boolean): void
  warp?(g: unknown, sec: number): number
  callouts(): { marks: Array<Box & { own: Box | null }> } | null
}

test('a 3D tower\'s pooled Marks stand above it, not on its body', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 27: true } })))
  await page.goto('/hedgerow/?sandbox=1&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const g = hg.game()
    const path = [...(g.level.path ?? []), ...(g.level.path2 ?? [])]
    const near = (c: number, r: number) => Math.min(...path.map(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r)))
    const spots: number[][] = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (near(c, r) === 1) spots.push([c, r])
    let n = 0
    for (const [c, r] of spots) {
      if (n >= 8) break
      if (hg.place(g, g.level.towers[n % g.level.towers.length]!, c!, r!).ok) n++
    }
    hg.arm?.(g)
    hg.sendWave(g, true)
  })
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600)
    await page.evaluate(() => (document.querySelector('.intro:not([hidden]) .intro-go') as HTMLElement | null)?.click())
  }
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    hg.warp?.(hg.game(), 7)
  })
  let seen = 0
  const on: string[] = []
  for (let i = 0; i < 60 && (seen < 20 || i < 20); i++) {
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.callouts())
    for (const m of r?.marks ?? []) {
      if (!m.own || m.w === 0) continue
      seen++
      const t = m.own
      // 2 px of give: the tower breathes at rest
      if (m.x < t.x + t.w - 2 && m.x + m.w > t.x + 2 && m.y < t.y + t.h - 2 && m.y + m.h > t.y + 2) on.push(JSON.stringify({ m, t }))
    }
  }
  expect(seen).toBeGreaterThan(0)
  expect(on.slice(0, 3)).toEqual([])
})
