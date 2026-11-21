import { test, expect } from '@playwright/test'

// Plan item 308: a solved board greens the valley's fields over: the tan fallow turns 30 degrees or more of hue toward
// the wet-field green, the pale green crops deepen (in a wave; under reduced motion a single fade). Plan item 508: the
// stubble and the season's poster crops (rapeseed or mustard, lavender or phacelia, kale) keep their own hue, so the
// solved valley stays a patchwork of the farming year rather than one green.
const rgb = (c: string): [number, number, number] => {
  const v = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number]
  return c.startsWith('color(') ? v : (v.map((x) => x / 255) as [number, number, number])
}
const light = (c: string): number => {
  const [r, g, b] = rgb(c)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}
const hue = (c: string): number => {
  const [r, g, b] = rgb(c)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

test('a solved board greens the valley over', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  const fills = () =>
    page
      .locator('#valley-paint .vl-f')
      .evaluateAll((els) =>
        els.map((e) => ({
          kind: e.classList.contains('vl-f-crop') ? 'crop' : e.classList.contains('vl-f-fallow') ? 'fallow' : /vl-f-(wheat|rapeseed|mustard|lavender|phacelia|kale)\b/.test(e.getAttribute('class') ?? '') ? 'kept' : 'other',
          fill: getComputedStyle(e).fill,
        })),
      )
  const before = await fills()
  expect(before.length).toBeGreaterThan(0)
  await expect(page.locator('#valley-paint')).not.toHaveAttribute('data-greened', '')
  await page.locator('[data-last]').click({ force: true })
  await expect(page.locator('#valley-paint')).toHaveAttribute('data-greened', '')
  await page.waitForTimeout(800)
  const after = await fills()
  expect(before.some((f) => f.kind === 'kept'), 'a poster crop or stubble on the board').toBe(true)
  for (const [i, { kind, fill }] of after.entries()) {
    const was = before[i]!.fill
    const shift = Math.abs(hue(fill) - hue(was))
    if (kind === 'crop') {
      expect(light(was) - light(fill), `crop ${i}: ${was} -> ${fill}`).toBeGreaterThanOrEqual(0.15)
    } else if (kind === 'fallow') {
      expect(Math.min(shift, 360 - shift), `field ${i}: ${was} -> ${fill}`).toBeGreaterThanOrEqual(30)
    } else if (kind === 'kept') {
      // (at D the in-play haze over the valley lifts as well, which moves a hue up to about 20 degrees)
      expect(Math.min(shift, 360 - shift), `kept ${i}: ${was} -> ${fill}`).toBeLessThanOrEqual(25)
    }
  }
})

// Plan item 499: on a desktop the valley recedes (toward the paper) while the board is in play, and comes back to
// full colour once it's solved.
test('at D the valley recedes during play and returns in full colour when solved', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop stage')
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  const vk = () => page.locator('.stage .valley').first().evaluate((e) => getComputedStyle(e).getPropertyValue('--vk').trim())
  expect(await vk()).toBe('64%')
  await page.locator('[data-last]').click({ force: true })
  await expect(page.locator('.board.won')).toHaveCount(1)
  expect(await vk()).toBe('100%')
})

// Plan item 567: during play the valley answers the water: each plot follows the board's field tile nearest it (and
// each field owns its two nearest plots), so watered fields green their plots before the solve.
test('watered fields green the valley plots beside them during play', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, seenHelp: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  // a full turn of one tile re-renders the board without changing it
  const ch = page.locator('#board g.cell.channel:not([data-last])').first()
  for (let k = 0; k < 6; k++) await ch.click({ force: true })
  await expect(page.locator('#valley-paint')).not.toHaveAttribute('data-greened', '')
  const m = await page.evaluate(() => ({
    wetFields: document.querySelectorAll('#board g.cell.field.wet').length,
    wetPlots: document.querySelectorAll('#valley-paint .vl-f[data-wet]').length,
  }))
  expect(m.wetFields, JSON.stringify(m)).toBeGreaterThan(0)
  expect(m.wetPlots, JSON.stringify(m)).toBeGreaterThanOrEqual(2)
  // Plan item 567 slice 2: each wet plot's sprouts come up
  await expect(page.locator('#valley-paint .vl-sprouts[data-wet]')).toHaveCount(m.wetPlots)
})

test('under reduced motion the valley sprouts fade in place, no transform', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, seenHelp: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  const ch = page.locator('#board g.cell.channel:not([data-last])').first()
  for (let k = 0; k < 6; k++) await ch.click({ force: true })
  const sprout = page.locator('#valley-paint .vl-sprouts[data-wet] .vl-sprout').first()
  await expect(sprout).toBeAttached()
  const t = await sprout.evaluate((el) => ({ transform: getComputedStyle(el).transform, prop: getComputedStyle(el).transitionProperty }))
  expect(t.transform).toBe('none')
  expect(t.prop).not.toContain('transform')
})

test('plan item 567: Bea waves as she reaches her garden at a solve, and only then', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, seenHelp: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  await expect(page.locator('.bea-waiting .ga-wave')).toBeHidden()
  await page.locator('[data-last]').click({ force: true })
  const wave = page.locator('.bea-runner .ga-wave')
  await expect(wave).toBeAttached()
  expect(await wave.evaluate((el) => getComputedStyle(el).animationName)).toBe('bea-wave')
})

// Plan item 582: each plot has a cut edge (6 px at D, shaded at the top and lit at the foot), and a solved board's
// every connected ditch carries visible water.
test('plan item 582: the tiles have a 6 px cut edge at D and a solve fills every ditch', async ({ page }) => {
  const vp = page.viewportSize()!
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, seenHelp: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  const bevel = await page.locator('.cell:not(.stone) .tile-bevel').first().evaluate((e) => ({ w: getComputedStyle(e).strokeWidth, s: getComputedStyle(e).stroke }))
  expect(bevel.s).toContain('tile-cut')
  if (vp.width >= 1100) expect(parseFloat(bevel.w)).toBeGreaterThanOrEqual(6)
  await page.locator('[data-last]').click({ force: true })
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#board .cell.channel:not(.wet), #board .cell.field:not(.wet)').length), { timeout: 5000 }).toBe(0)
})

// Plan item 590: at D the lesson notebook has no dead stretch: its field notes tally the taps and Cath's margin
// note follows the water.
test('plan item 590: the lesson notebook fills its rail and its field notes follow each tap', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width < 1100 || vp.height < 640, 'the desktop notebook rail')
  await page.goto('/runnel/?lesson')
  await page.waitForSelector('#board .tiles > g.cell.lesson-target')
  const gap = () =>
    page.evaluate(() => {
      const kids = [...document.getElementById('lesson-card')!.children].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0)
      let g = 0
      for (let i = 1; i < kids.length; i++) g = Math.max(g, kids[i]!.top - kids[i - 1]!.bottom)
      return g
    })
  expect(await gap()).toBeLessThanOrEqual(48)
  const before = await page.locator('#lc-field-notes').innerText()
  await page.locator('#board .tiles > g.cell.lesson-target').click()
  await expect(page.locator('#lc-fn-of')).toHaveText('1 of 3')
  expect(await page.locator('#lc-field-notes').innerText()).not.toBe(before)
})
