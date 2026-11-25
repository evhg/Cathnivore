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

// Plan item 492 in 3D: walking, she leaves a trail of prints (counted: headless WebGL draws a frame every few seconds).
test('3D: Cath leaves footprints as she walks', async ({ page }) => {
  test.setTimeout(240_000)
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate((t) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 3 }, seenBefore: { 3: true }, tips: t })), tips)
  await page.goto('/hedgerow/?sandbox=1&level=3')
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow?: H3 }).hedgerow?.rosette3d?.() ?? null), { timeout: 180_000 }).not.toBeNull()
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HF }).hedgerow
    const g = hg.game()!
    hg.sendWave(g, true)
    g.hero.tx = g.hero.x + 2.5
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HF }).hedgerow.footprints()), { timeout: 60_000 }).toBeGreaterThan(1)
})

// Plan item 681: the level-up is a moment on her, not a banner over the battle: a badge rises from her and flies to
// her button, which bumps within 1.2 s; no banner shows.
test('a level-up badge flies from Cath to her button, no banner over the lane', async ({ page }) => {
  test.setTimeout(120_000)
  const stars = Object.fromEntries(Array.from({ length: 2 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 3: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  const t0 = Date.now()
  await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.heroUp())
  await expect(page.locator('.lvl-badge')).toHaveCount(1, { timeout: 2000 })
  // plan item 689: the bump lands on a Cath control the player can see (#btn-cath is the menu's, hidden in a level)
  await expect(page.locator('.lvl-bump')).toHaveCount(1, { timeout: 2000 })
  await expect(page.locator('.lvl-bump')).toBeVisible()
  expect(Date.now() - t0).toBeLessThanOrEqual(1200 + 400)
  await expect(page.locator('#stage')).toHaveAttribute('data-hero-level', '2')
  expect(await page.locator('.banner.show').count()).toBe(0)
})

// Plan item 689: on level 34 she stands near the top of the field: the badge's rise stays below the top HUD and
// flies toward a Cath control that is on screen (at P it flew to the hidden menu button's empty box, over the HUD).
test('level 34: the level-up badge never rises under the top HUD', async ({ page }) => {
  test.setTimeout(120_000)
  const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 34: true }, tips: t })), [stars, tips])
  await page.goto('/hedgerow/?sandbox=1&2d&level=34')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  // sample the badge every frame of its flight: its top never above the HUD's bottom, and it ends nearer the bump
  await page.evaluate(() => {
    const w = window as unknown as { hedgerow: HG; __tops: number[]; __last: [number, number] }
    w.__tops = []
    const tick = () => {
      const r = document.querySelector('.lvl-badge')?.getBoundingClientRect()
      if (r) { w.__tops.push(r.top); w.__last = [r.left + r.width / 2, r.top + r.height / 2] }
      if (w.__tops.length < 400) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // stand her on the field's top row (where the 05:30 critique caught the badge half under the HUD at D)
    const h = (w.hedgerow.game() as unknown as { hero: { x: number; y: number; tx: number; ty: number } }).hero
    h.y = h.ty = 0.6
    requestAnimationFrame(() => requestAnimationFrame(() => w.hedgerow.heroUp()))
  })
  await expect(page.locator('.lvl-bump')).toHaveCount(1, { timeout: 3000 })
  const hud = (await page.locator('.hud').boundingBox())!
  const { tops, last } = await page.evaluate(() => { const w = window as unknown as { __tops: number[]; __last: [number, number] }; return { tops: w.__tops, last: w.__last } })
  expect(tops.length).toBeGreaterThan(2)
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(hud.y + hud.height)
  const bump = (await page.locator('.lvl-bump').boundingBox())!
  expect(bump.width).toBeGreaterThan(0)
  expect(Math.hypot(last[0] - (bump.x + bump.width / 2), last[1] - (bump.y + bump.height / 2))).toBeLessThan(120)
})
