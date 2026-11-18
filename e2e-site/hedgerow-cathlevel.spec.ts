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

// Plan item 492: moved across the field she leaves footprints that fade within a second; none under reduced motion.
type HF = { game(): { hero: { x: number; y: number; tx: number; ty: number } } | null; sendWave(g: unknown, f?: boolean): void; footprints(): number | null }
for (const reduce of [false, true]) {
  test(`Cath leaves footprints as she walks${reduce ? ' (reduced motion: none)' : ''}`, async ({ page }) => {
    test.setTimeout(120_000)
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate((t) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 3 }, seenBefore: { 3: true }, tips: t })), tips)
    await page.goto('/hedgerow/?sandbox=1&2d&level=3')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HF }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.evaluate(() => {
      const hg = (window as unknown as { hedgerow: HF }).hedgerow
      const g = hg.game()!
      hg.sendWave(g, true)
      g.hero.tx = g.hero.x + 3
      g.hero.ty = g.hero.y + 1
    })
    if (reduce) {
      await page.waitForTimeout(800)
      expect(await page.evaluate(() => (window as unknown as { hedgerow: HF }).hedgerow.footprints())).toBe(0)
      return
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HF }).hedgerow.footprints()), { timeout: 10_000 }).toBeGreaterThan(2)
    // she arrives, and the trail fades out behind her
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HF }).hedgerow.footprints()), { timeout: 20_000 }).toBe(0)
  })
}

// Plan item 492 in 3D: the rosette stands at her feet on the Fleet and follows her level.
type H3 = { game(): unknown; heroUp(): number | null; rosette3d(): { level: number; visible: boolean } | null }
test('3D: the rosette at her feet follows her level', async ({ page }) => {
  test.setTimeout(240_000)
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate((t) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 3 }, seenBefore: { 3: true }, tips: t })), tips)
  await page.goto('/hedgerow/?sandbox=1&level=3')
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow?: H3 }).hedgerow?.rosette3d?.() ?? null), { timeout: 180_000 }).toEqual({ level: 1, visible: true })
  await page.evaluate(() => { const hg = (window as unknown as { hedgerow: H3 }).hedgerow; hg.heroUp(); hg.heroUp() })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: H3 }).hedgerow.rosette3d()), { timeout: 60_000 }).toEqual({ level: 3, visible: true })
})
