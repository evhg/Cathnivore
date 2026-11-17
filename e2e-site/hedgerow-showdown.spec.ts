import { expect, test } from '@playwright/test'

// Plan item 479: the last round is called as a showdown: `#stage[data-showdown]` within 150 ms of its call, a
// 'Last round' ribbon over the field, Cath squares up; an earlier round calls none of it.
type HG = { game(): { wave: number; phase: string; level: { waves: unknown[] } }; sendWave(g: unknown, force?: boolean): void }
test('the last round is called as a showdown, an earlier one is not', async ({ page }) => {
  test.setTimeout(120_000)
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 21: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  const stage = page.locator('#stage')
  // round 1: no showdown
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    hg.sendWave(hg.game(), true)
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game().wave)).toBe(1)
  await page.waitForTimeout(500)
  expect(await stage.getAttribute('data-showdown')).toBeNull()
  // jump to the round before the last, then call the last
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const g = hg.game() as { wave: number; phase: string; enemies: unknown[]; level: { waves: unknown[] } }
    g.enemies.length = 0
    g.wave = g.level.waves.length - 1
    g.phase = 'build'
    const w = window as unknown as { __called: number; __seen: number }
    new MutationObserver(() => (w.__seen ??= performance.now())).observe(document.getElementById('stage')!, { attributes: true, attributeFilter: ['data-showdown'] })
    w.__called = performance.now()
    hg.sendWave(g, true)
  })
  await expect(stage).toHaveAttribute('data-showdown', '', { timeout: 5_000 })
  const lag = await page.evaluate(() => { const w = window as unknown as { __called: number; __seen: number }; return w.__seen - w.__called })
  expect(lag).toBeLessThanOrEqual(150 + 1000 / 15) // the call lands on the next drawn frame
  await expect(page.locator('.banner.showdown.show')).toBeVisible()
  await expect(page.locator('.banner.showdown strong')).toHaveText(/last round/i)
  // and Cath says so where she speaks (her bubble on the field mid-round)
  await expect(page.locator('#bubble-text')).toHaveText(/last lot/i)
  // the depot's shutter is fully up and the rep stands at the door through the round (every depot in the frame)
  const depots = page.locator('.depot')
  if (await depots.count()) await expect(page.locator('.depot:not([data-showdown])')).toHaveCount(0)
})

// Plan item 479: the win's last knockout is held: the render clock slows for 600-800 ms (by its frame timestamps),
// then the harvest starts within 400 ms; under reduced motion there is no hold and the harvest starts at once.
type HK = { game(): { phase: string }; knockout(): { start: number; end: number; frames: number[]; harvest: number } | null }
for (const reduce of [false, true]) {
  test(`the win's last knockout is held, then the harvest${reduce ? ' (reduced motion: no hold)' : ''}`, async ({ page }) => {
    test.setTimeout(120_000)
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 3: true }, tips: t })), [stars, tips])
    await page.goto('/hedgerow/?sandbox=1&2d&showdown&level=3')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HK }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => { (window as unknown as { hedgerow: HK }).hedgerow.game().phase = 'won' })
    await expect(page.locator('.harvest')).toBeAttached({ timeout: 5_000 })
    const k = await page.evaluate(() => (window as unknown as { hedgerow: HK }).hedgerow.knockout())
    if (reduce) {
      expect(k).toBeNull()
      expect(await page.locator('#stage').getAttribute('data-knockout')).toBeNull()
      return
    }
    expect(k).not.toBeNull()
    expect(k!.frames.length).toBeGreaterThan(0)
    const slow = k!.end - k!.start
    expect(slow, `held ${slow} ms`).toBeGreaterThanOrEqual(600)
    expect(slow, `held ${slow} ms`).toBeLessThanOrEqual(800)
    expect(k!.harvest - k!.end).toBeLessThanOrEqual(400)
    expect(await page.locator('#stage').getAttribute('data-knockout')).toBeNull()
  })
}
