import { expect, test } from '@playwright/test'

// Plan item 468: towers you can watch fight. Mid-round, every tower with a vehicle in range attacks within a second
// (the stage's `data-attack-towers` lists the towers that fired in the last second), and a knockout's Marks fly to
// the purse as a coin that lands within 600 ms (`data-coins` counts the landings; none under reduced motion).
type HG = {
  game(): { wave: number; level: { cols: number; rows: number }; towers: Array<{ id: number }> }
  sendWave(g: unknown, force?: boolean): void
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  inReach(): number[]
}
for (const reduced of [false, true])
  test(`towers attack and knockouts pay into the purse${reduced ? ' (reduced motion)' : ''}`, async ({ page, hasTouch }) => {
    test.skip(hasTouch && reduced, 'one reduced-motion run is enough')
    test.setTimeout(120_000)
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    const stars = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 13: true }, tips: t })), [stars, tips])
    await page.goto('/hedgerow/?sandbox=1&2d&level=13')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.evaluate(() => {
      const hg = (window as unknown as { hedgerow: HG }).hedgerow
      const g = hg.game()
      // Spaced apart (scarecrows next door to each other throw slower), alternating scarecrows and hedges.
      const at: Array<[number, number]> = []
      for (let r = 0; r < g.level.rows && at.length < 8; r++)
        for (let c = 0; c < g.level.cols && at.length < 8; c++) {
          if (at.some(([ac, ar]) => Math.abs(ac - c) <= 1 && Math.abs(ar - r) <= 1)) continue
          if (hg.place(g, at.length % 2 ? 'hedgerow' : 'scarecrow', c, r).ok) at.push([c, r])
        }
      hg.sendWave(g, true)
    })
    const stage = page.locator('#stage')
    await expect.poll(() => stage.getAttribute('data-attack'), { timeout: 60_000 }).not.toBeNull()
    await expect.poll(async () => (await stage.getAttribute('data-attack-towers'))?.split(',').filter(Boolean).length ?? 0, { timeout: 30_000 }).toBeGreaterThan(0)
    // Every tower (turnips or a hedge's slow) with a vehicle in reach attacks within a second: take the towers in
    // reach now, then every tower the stage names over the next 1.2 s must include them.
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.inReach().length), { timeout: 30_000 }).toBeGreaterThan(1)
    const { want, missed } = await page.evaluate(
      () =>
        new Promise<{ want: number[]; missed: number[] }>((done) => {
          const hg = (window as unknown as { hedgerow: HG }).hedgerow
          const st = document.getElementById('stage')!
          const want = hg.inReach()
          const seen = new Set<string>()
          const read = () => (st.dataset.attackTowers ?? '').split(',').forEach((id) => id && seen.add(id))
          const obs = new MutationObserver(read)
          obs.observe(st, { attributes: true, attributeFilter: ['data-attack-towers'] })
          setTimeout(() => {
            obs.disconnect()
            read()
            done({ want, missed: want.filter((id) => !seen.has(String(id))) })
          }, 1200)
        }),
    )
    expect(want.length).toBeGreaterThan(0)
    expect(missed).toEqual([])
    if (reduced) {
      await page.waitForTimeout(4000)
      expect(await stage.getAttribute('data-coins')).toBeNull()
      expect(await page.locator('.coin-fly').count()).toBe(0)
      return
    }
    // A coin takes off at a knockout and lands at the purse within 600 ms.
    const ms = await page.evaluate(
      () =>
        new Promise<number>((done) => {
          new MutationObserver((list, obs) => {
            for (const m of list)
              for (const n of m.addedNodes)
                if (n instanceof HTMLElement && n.classList.contains('coin-fly')) {
                  // Plan item 748: on the lane it starts small and faint, so it never hides the next vehicle.
                  const k0 = n.getAnimations()[0]?.effect instanceof KeyframeEffect ? (n.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes()[0] : undefined
                  if (!k0 || Number(k0.opacity) > 0.5 || !/scale\(0\.[0-6]/.test(String(k0.transform))) {
                    obs.disconnect()
                    done(-1)
                    return
                  }
                  const t0 = performance.now()
                  new MutationObserver((_l, o2) => {
                    if (!n.isConnected) {
                      o2.disconnect()
                      done(performance.now() - t0)
                    }
                  }).observe(document.body, { childList: true })
                  obs.disconnect()
                  return
                }
          }).observe(document.body, { childList: true })
        }),
    )
    expect(ms).toBeGreaterThanOrEqual(0)
    expect(ms).toBeLessThanOrEqual(600)
    await expect.poll(() => stage.getAttribute('data-coins'), { timeout: 10_000 }).not.toBeNull()
  })
