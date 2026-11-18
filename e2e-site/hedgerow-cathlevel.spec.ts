import { expect, test } from '@playwright/test'

// Plan item 492: on the Fleet Cath grows through a run, and the field shows it: the stage carries her level, and a
// level-up (the sandbox raises her as the layers popped would) moves it within 150 ms of the event reaching the page.
type HG = { game(): { hero: { level: number }; level: { rules?: string } } | null; heroUp(): number | null }
test('Cath levels up on the field: the stage carries her level and moves with it', async ({ page }) => {
  test.setTimeout(120_000)
  const stars = Object.fromEntries(Array.from({ length: 2 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 3: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.level.rules)).toBe('fleet')
  const stage = page.locator('#stage')
  await expect(stage).toHaveAttribute('data-hero-level', '1')
  const lv = await page.evaluate(() => {
    const w = window as unknown as { hedgerow: HG; __up: number; __seen: number }
    new MutationObserver(() => (w.__seen ??= performance.now())).observe(document.getElementById('stage')!, { attributes: true, attributeFilter: ['data-hero-level'] })
    w.__up = performance.now()
    return w.hedgerow.heroUp()
  })
  expect(lv).toBe(2)
  await expect(stage).toHaveAttribute('data-hero-level', '2')
  // the event is drained on the next stepped frame, so the move lands within a frame or two of the call
  const lag = await page.evaluate(() => { const w = window as unknown as { __up: number; __seen: number }; return w.__seen - w.__up })
  expect(lag).toBeLessThanOrEqual(150 + 1000 / 15)
})
