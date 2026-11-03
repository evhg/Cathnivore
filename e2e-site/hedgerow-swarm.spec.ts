import { expect, test } from '@playwright/test'

// Plan item 45: a late round on level 38 (its last round, 19, sandbox, 2D) reads as a convoy of separate vehicles, not a
// pile: 40 or more drawn one by one, and a tower's pooled Marks counter rises as it knocks layers off.
type HG = {
  game(): { wave: number; enemies: unknown[]; towers: unknown[] }
  sendWave(g: unknown, force?: boolean): void
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  convoy(): { drawn: number; column: number; marks: number; shards: number } | null
}
for (const reduced of [false, true])
  test(`a late round is a convoy${reduced ? ' (reduced motion)' : ''}`, async ({ page, hasTouch }) => {
    test.skip(hasTouch && reduced, 'one reduced-motion run is enough')
    test.setTimeout(240_000)
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 38: true }, tips: t })), [stars, tips])
    await page.goto('/hedgerow/?sandbox=1&2d&level=38')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.evaluate(() => {
      const hg = (window as unknown as { hedgerow: HG }).hedgerow
      const g = hg.game() as unknown as { wave: number; level: { cols: number; rows: number } }
      // A few towers so layers come off, then its last round (19; the plan said 20, level 38 has 19).
      let placed = 0
      for (let r = 0; r < g.level.rows && placed < 6; r++) for (let c = 0; c < g.level.cols && placed < 6; c++) if (hg.place(g, 'cannon', c, r).ok) placed++
      g.wave = 18
      hg.sendWave(g, true)
    })
    await page.waitForFunction(() => ((window as unknown as { hedgerow: HG }).hedgerow.convoy()?.drawn ?? 0) >= 40, null, { timeout: 120_000 })
    await page.waitForFunction(() => ((window as unknown as { hedgerow: HG }).hedgerow.convoy()?.marks ?? 0) > 0, null, { timeout: 60_000 })
    const st = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.convoy())
    expect(st!.drawn).toBeGreaterThanOrEqual(40)
    // Layers come off in shards of their colour, except under reduced motion.
    if (reduced) expect(st!.shards).toBe(0)
    else expect(st!.shards).toBeGreaterThan(0)
    await page.screenshot({ path: `e2e/screenshots/swarm45/late${reduced ? '-reduced' : ''}-${hasTouch ? 'P' : 'D'}.png` })
  })
