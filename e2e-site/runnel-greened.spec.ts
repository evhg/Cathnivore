import { test, expect } from '@playwright/test'

// Plan item 308: a solved board greens the valley's fields over: the tan fields (wheat, fallow) turn 30 degrees or more
// of hue toward the wet-field green, the pale green crops deepen (in a wave; under reduced motion a single fade).
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
    page.locator('#valley-paint .vl-f-crop, #valley-paint .vl-f-wheat, #valley-paint .vl-f-fallow').evaluateAll((els) => els.map((e) => ({ crop: e.classList.contains('vl-f-crop'), fill: getComputedStyle(e).fill })))
  const before = await fills()
  expect(before.length).toBeGreaterThan(0)
  await expect(page.locator('#valley-paint')).not.toHaveAttribute('data-greened', '')
  await page.locator('[data-last]').click({ force: true })
  await expect(page.locator('#valley-paint')).toHaveAttribute('data-greened', '')
  await page.waitForTimeout(800)
  const after = await fills()
  for (const [i, { crop, fill }] of after.entries()) {
    const was = before[i]!.fill
    if (crop) {
      expect(light(was) - light(fill), `crop ${i}: ${was} -> ${fill}`).toBeGreaterThanOrEqual(0.15)
    } else {
      const shift = Math.abs(hue(fill) - hue(was))
      expect(Math.min(shift, 360 - shift), `field ${i}: ${was} -> ${fill}`).toBeGreaterThanOrEqual(30)
    }
  }
})
