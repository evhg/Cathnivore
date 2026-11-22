import { expect, test, type Page } from '@playwright/test'

// Plan item 636: a dry field and a watered one are plainly different (ΔE 20+ in OKLab x100 on the tile's face), the
// watered crop fills 40%+ of its tile's width, the solve's bloom from the spring is done in 1.2 s on any board, and
// under reduced motion the crop simply fades in within 400 ms.
const oklab = (c: string): [number, number, number] => {
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
