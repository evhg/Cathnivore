import { expect, test } from '@playwright/test'

// Plan item 497: in 2D two vehicles wait at the gate (the depot's board and the plate carry the rest), and each one
// that pulls out of the gate kicks up a puff of lane dust; none under reduced motion.
type HG = { game(): unknown; sendWave(g: unknown, f?: boolean): void; rolloutDust(): number | null; gateQueue(): { leads: unknown[] } | null }
for (const reduce of [false, true]) {
  test(`2D: two wait at the gate, and the convoy pulls out in dust${reduce ? ' (reduced motion: no dust)' : ''}`, async ({ page }) => {
    test.setTimeout(120_000)
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 21: true }, tips: t })), [stars, tips])
    await page.goto('/hedgerow/?sandbox=1&2d&level=21')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.gateQueue()?.leads.length ?? 0)).toBeGreaterThan(0)
    expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.gateQueue()!.leads.length)).toBeLessThanOrEqual(2)
    await page.evaluate(() => { const hg = (window as unknown as { hedgerow: HG }).hedgerow; hg.sendWave(hg.game(), true) })
    if (reduce) {
      await page.waitForTimeout(2500)
      expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.rolloutDust())).toBe(0)
      return
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.rolloutDust()), { timeout: 15_000 }).toBeGreaterThan(0)
  })
}
