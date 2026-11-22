import { expect, test } from '@playwright/test'

// Plan item 181: the /games/ landing as Cath's market stall: the hero holds Cath and today's Runnel on a slate
// ([data-cta="daily"]); her feet on the awning's rail (no floating figure); the posters 280 px or more at D, and a
// poster pointed at swings 3 degrees or less (none under reduced motion).
test('the landing is Cath\'s stall, the games hung from its awning', async ({ page }) => {
  await page.goto('/games/')
  const hero = page.locator('.stall-hero')
  await expect(hero).toBeVisible()
  await expect(hero.locator('[data-cta="daily"]')).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  const vp = page.viewportSize()!
  const m = await page.evaluate(() => {
    const cath = document.getElementById(innerWidth < 600 ? 'hero-cath-mini' : 'hero-cath')!.getBoundingClientRect()
    const games = document.querySelector('.hero-games')!
    const rail = games.getBoundingClientRect().top + parseFloat(getComputedStyle(games, '::after').top)
    return { feet: cath.bottom, rail, widths: [...document.querySelectorAll('.hero-game')].map((e) => e.getBoundingClientRect().width) }
  })
  if (vp.width >= 900) {
    expect(Math.abs(m.feet - m.rail)).toBeLessThanOrEqual(10)
    for (const w of m.widths) expect(w).toBeGreaterThanOrEqual(280)
    const first = page.locator('.hero-game').first()
    await first.hover()
    // poll: on a loaded CI runner the swing can start well after 300 ms (2026-11-15, E2E on 00d8a485)
    const rot = () => first.evaluate((e) => Math.abs(parseFloat(getComputedStyle(e).rotate) || 0))
    await expect.poll(rot, { timeout: 4000 }).toBeGreaterThan(0)
    for (let i = 0; i < 5; i++) {
      expect(await rot()).toBeLessThanOrEqual(3)
      await page.waitForTimeout(150)
    }
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('a poster pointed at stays still', async ({ page }) => {
    await page.goto('/games/')
    const first = page.locator('.hero-game').first()
    await expect(first).toBeVisible()
    await first.hover()
    expect(await first.evaluate((e) => getComputedStyle(e).rotate)).toBe('none')
  })
})

// Plan item 243: at D the hero is one scene, Cath working her stall: the stall spans 35% or more of the hero, its
// counter stands in front of her with its foot on the posters' awning rail, the words hang on its slate board.
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`at ${vp.width}x${vp.height} Cath stands behind her stall's counter`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('phone'), 'desktop')
    await page.setViewportSize(vp)
    await page.goto('/games/')
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
    await page.waitForTimeout(3400)
    const m = await page.evaluate(() => {
      const box = (svg: Element) => {
        const bs = [...svg.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width && b.height)
        return { l: Math.min(...bs.map((b) => b.left)), t: Math.min(...bs.map((b) => b.top)), r: Math.max(...bs.map((b) => b.right)), b: Math.max(...bs.map((b) => b.bottom)) }
      }
      const hero = document.querySelector('.hero')!.getBoundingClientRect()
      const games = document.querySelector('.hero-games')!
      const rail = games.getBoundingClientRect().top + parseFloat(getComputedStyle(games, '::after').top)
      const cath = document.querySelector('#hero-cath')!.getBoundingClientRect()
      const btns = [...document.querySelectorAll('.cta-row > *')].map((e) => e.getBoundingClientRect())
      const words = { left: Math.min(...btns.map((b) => b.left)), right: Math.max(...btns.map((b) => b.right)), top: Math.min(...btns.map((b) => b.top)), bottom: Math.max(...btns.map((b) => b.bottom)) }
      const z = (s: string) => Number(getComputedStyle(document.querySelector(s)!).zIndex)
      return { hero: hero.width, back: box(document.querySelector('.hero-booth')!), counter: box(document.querySelector('.hero-counter')!), rail, cath: { l: cath.left, r: cath.right, t: cath.top, b: cath.bottom }, words: { l: words.left, r: words.right, t: words.top, b: words.bottom }, zc: z('#hero-cath'), zf: z('.hero-counter'), zb: z('.hero-booth') }
    })
    expect((m.back.r - m.back.l) / m.hero).toBeGreaterThanOrEqual(0.35)
    // the counter's foot on the rail, its top at her hips, clear of the buttons; plan item 631 (reversing 563): she
    // stands behind it, so it covers her lower body, 300 px or more of her figure
    expect(Math.abs(m.counter.b - m.rail)).toBeLessThanOrEqual(4)
    expect(m.zb).toBeLessThan(m.zc)
    expect(m.zf).toBeGreaterThan(m.zc)
    if (vp.width >= 1440) expect(m.cath.b - m.cath.t).toBeGreaterThanOrEqual(300)
    expect(m.counter.t).toBeGreaterThan(m.cath.t + (m.cath.b - m.cath.t) * 0.45)
    expect(m.counter.l).toBeLessThan(m.cath.l)
    expect(m.counter.r).toBeGreaterThan(m.cath.r)
    expect(m.counter.r).toBeLessThan(m.words.l)
    // the stall frames the words: they sit inside its posts
    expect(m.back.l).toBeLessThan(m.cath.l)
    expect(m.back.r).toBeGreaterThan(m.words.r)
  })
}

// Plan item 631: the four games stand on the counter as its wares, each a link to its game, at her side.
test('at D each game is a ware on the counter that links to it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('phone'), 'desktop')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/games/')
  await page.waitForTimeout(3400)
  const wares = page.locator('.stall-ware')
  await expect(wares).toHaveCount(4)
  expect(await wares.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/cathnivore/', '/runnel/', '/hedgerow/', '/nightshift/'])
  const m = await page.evaluate(() => {
    const cath = document.querySelector('#hero-cath svg')!.getBoundingClientRect()
    const w = [...document.querySelectorAll('.stall-ware')].map((e) => e.getBoundingClientRect())
    return { cathR: cath.right, cathB: cath.bottom, wares: w.map((b) => ({ l: b.left, b: b.bottom, w: b.width })) }
  })
  for (const w of m.wares) {
    expect(w.l).toBeGreaterThanOrEqual(m.cathR - 8)
    expect(w.b).toBeLessThan(m.cathB)
    expect(w.w).toBeGreaterThanOrEqual(56)
  }
  await wares.nth(1).click()
  await expect(page).toHaveURL(/\/runnel\//)
})

// Plan item 640: at D the counter's front is today's board: a chalk slate whose lines link to each game's daily, its
// type 14 px or more, inside the counter and clear of the words' board.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`the counter's slate lists today's dailies as links at ${width}x${height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'site-desktop', 'the desktop stall')
    await page.setViewportSize({ width, height })
    await page.goto('/games/')
    const slate = page.locator('.stall-slate')
    await expect(slate).toBeVisible()
    await expect(slate.locator('a')).toHaveCount(4)
    expect(await slate.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/cathnivore/', '/runnel/', '/hedgerow/', '/nightshift/'])
    const m = await slate.evaluate((s) => {
      const sizes = [...s.querySelectorAll<HTMLElement>('a, a small, .slate-head')].filter((e) => e.getClientRects().length).map((e) => parseFloat(getComputedStyle(e).fontSize))
      const b = s.getBoundingClientRect()
      const words = document.querySelector('.hero-text')!.getBoundingClientRect()
      return { min: Math.min(...sizes), overflow: s.scrollWidth - s.clientWidth, right: b.right, wordsLeft: words.left }
    })
    expect(m.min).toBeGreaterThanOrEqual(14)
    expect(m.overflow).toBeLessThanOrEqual(1)
    expect(m.right).toBeLessThanOrEqual(m.wordsLeft)
  })
}
