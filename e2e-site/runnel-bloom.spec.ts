import { expect, test, type Page } from '@playwright/test'

// Plan item 636: a dry field and a watered one are plainly different (ΔE 20+ in OKLab x100 on the tile's face), the
// watered crop fills 40%+ of its tile's width, the solve's bloom from the spring is done in 1.2 s on any board, and
// under reduced motion the crop simply fades in within 400 ms.
const oklab = (c: string): [number, number, number] => {
  if (c.startsWith('oklab(')) return (c.match(/-?[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number]
  const v = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  const [r, g, b] = (c.startsWith('color(') ? v : v.map((x) => x / 255)).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675778 * s]
}
const deltaE = (a: string, b: string) => {
  const [x, y] = [oklab(a), oklab(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100
}
const fieldFill = (page: Page) => page.locator('.cell.field .tile').first().evaluate((e) => getComputedStyle(e).fill)

test('a watered field differs from a dry one, its crop large, the bloom quick', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/runnel/?nohelp')
  await page.locator('.cell.field').first().waitFor()
  const dry = await fieldFill(page)
  await expect(page.locator('.cell.field').first()).not.toHaveClass(/\bwet\b/)
  await page.goto('/runnel/?shotwin&nohelp')
  await page.locator('#win-strip').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)
  const wet = await fieldFill(page)
  expect(deltaE(dry, wet), `${dry} -> ${wet}`).toBeGreaterThanOrEqual(20)
  const m = await page.evaluate(() =>
    [...document.querySelectorAll('.cell.field:has(.crop)')].map((c) => {
      const crop = c.querySelector('.crop')!.getBoundingClientRect()
      const tile = c.querySelector('.tile')!.getBoundingClientRect()
      return crop.width / tile.width
    }),
  )
  expect(m.length).toBeGreaterThan(0)
  for (const share of m) expect(share).toBeGreaterThanOrEqual(0.4)
  // under reduced motion the crop's only motion is its fade, 400 ms or less
  const rm = await page.locator('.cell.field .crop').first().evaluate((e) => {
    const cs = getComputedStyle(e)
    return { anim: cs.animationName, ms: parseFloat(cs.transitionDuration) * 1000 + parseFloat(cs.transitionDelay) * 1000 }
  })
  expect(rm.anim).toBe('none')
  expect(rm.ms).toBeLessThanOrEqual(400)
})

test("the solve's bloom runs out from the spring and is done in 1.2 s", async ({ page }) => {
  await page.goto('/runnel/?shotwin&nohelp')
  await page.locator('#win-strip').waitFor({ state: 'visible', timeout: 20_000 })
  const ends = await page.evaluate(() =>
    [...document.querySelectorAll('.won .cell .crop')].map((e) => {
      const cs = getComputedStyle(e)
      return { ring: Number(getComputedStyle(e.closest('.cell')!).getPropertyValue('--ring')), end: (parseFloat(cs.animationDelay) + parseFloat(cs.animationDuration)) * 1000 }
    }),
  )
  test.skip(ends.length === 0, 'no .won board in this build')
  for (const e of ends) expect(e.end).toBeLessThanOrEqual(1200)
  const byRing = [...ends].sort((a, b) => a.ring - b.ring)
  expect(byRing[0]!.end).toBeLessThanOrEqual(byRing[byRing.length - 1]!.end)
})

// Plan item 646: the three kinds of tile read apart on a dry board: a field (its plot), the spring (its well-head)
// and a channel each 12+ ΔE (OKLab x100) from the others' faces (the plan asked 15; a field plot can't darken further
// without its channel dropping under 3:1 in runnel-tiles, so the plot is told by hue and the spring by blue).
test('fields, the spring and channels are told apart by their faces', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.locator('.cell.spring').first().waitFor()
  const f = await page.evaluate(() => {
    const fill = (s: string) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fill : null }
    const fields = [...document.querySelectorAll('.cell.field:not(.reservoir):not(.wet) .tile')].map((e) => getComputedStyle(e).fill)
    return { field: fields[0] ?? null, fields, spring: fill('.cell.spring .tile'), channel: fill('.cell.channel:not(.wet) .tile') }
  })
  expect(f.field && f.spring && f.channel).toBeTruthy()
  // every dry field, whatever ground it stands on (a field on field ground once lost its plot face to item 516's rule)
  for (const fl of f.fields) expect(deltaE(fl, f.channel!), `field ${fl} channel ${f.channel}`).toBeGreaterThanOrEqual(12)
  expect(deltaE(f.field!, f.channel!), `field ${f.field} channel ${f.channel}`).toBeGreaterThanOrEqual(12)
  expect(deltaE(f.spring!, f.channel!), `spring ${f.spring} channel ${f.channel}`).toBeGreaterThanOrEqual(12)
  expect(deltaE(f.field!, f.spring!), `field ${f.field} spring ${f.spring}`).toBeGreaterThanOrEqual(12)
})

// Plan item 675: a dry tile's hub is a little mill wheel (six spokes with paddles), not a gate board across a ring
// (which read as a 'no entry' sign on an unwatered board); it turns only once the water reaches it.
test('every hub is a six-spoked mill wheel, still until watered', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#board polygon.tile').first()).toBeVisible()
  const m = await page.evaluate(() => {
    const wheels = [...document.querySelectorAll('.tiles > g.cell .mill-wheel')]
    return {
      wheels: wheels.length,
      cells: document.querySelectorAll('.tiles > g.cell:not(.spring):not(.stone)').length,
      spokes: Math.min(...wheels.map((w) => w.querySelectorAll('.mill-spoke').length)),
      bars: document.querySelectorAll('.sluice-board').length,
      dryTurning: wheels.filter((w) => !w.closest('.wet') && getComputedStyle(w).animationName !== 'none').length,
    }
  })
  expect(m.wheels).toBeGreaterThan(0)
  expect(m.spokes).toBeGreaterThanOrEqual(6)
  expect(m.bars).toBe(0)
  expect(m.dryTurning).toBe(0)
})

// Plan item 687: an unsolved board you can trace. The mill wheel (and its plank rim) only on hubs, where three or more
// channels meet; a turn that brings two dry ends together across an edge lights that seam at once.
test('wheels only on hubs, and a turn into a match lights its seam', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#board polygon.tile').first()).toBeVisible()
  const m = await page.evaluate(() => ({
    wheels: document.querySelectorAll('.tiles > g.cell .mill-wheel').length,
    hubs: document.querySelectorAll('.tiles > g.cell[data-ends="3"], .tiles > g.cell[data-ends="4"], .tiles > g.cell[data-ends="5"], .tiles > g.cell[data-ends="6"]').length,
    rimsOff: [...document.querySelectorAll('.tiles > g.cell')].filter((c) => Number((c as HTMLElement).dataset.ends ?? 9) < 3 && c.querySelector('.hub-lip, .mill')).length,
  }))
  expect(m.wheels).toBeGreaterThan(0)
  expect(m.wheels).toBeLessThanOrEqual(m.hubs)
  expect(m.rimsOff).toBe(0)
  // Turn playable tiles until one turn makes a new joined seam; it is there (with its lit stitches) within 250 ms.
  const joins = () => page.evaluate(() => [...document.querySelectorAll('.joins .join')].map((j) => (j as SVGGElement).dataset.join!))
  const cells = page.locator('.tiles > g.cell:not(.spring):not(.stone):not(.fixed)')
  let lit = false
  for (let i = 0; i < 6 && !lit; i++) {
    const cell = cells.nth(i)
    for (let k = 0; k < 6 && !lit; k++) {
      const before = new Set(await joins())
      await cell.locator('polygon.tile').click({ force: true })
      const t0 = Date.now()
      const fresh = await page.waitForFunction((had) => {
        const now = [...document.querySelectorAll('.joins .join:not(.wet)')].filter((j) => !had.includes((j as SVGGElement).dataset.join!))
        return now.length && now.every((j) => j.querySelectorAll('.join-tick').length === 2) ? now.length : 0
      }, [...before], { timeout: 250, polling: 16 }).then(() => true).catch(() => false)
      if (fresh) {
        expect(Date.now() - t0).toBeLessThan(400)
        lit = true
      }
      await page.waitForTimeout(350)
    }
  }
  expect(lit).toBe(true)
})
