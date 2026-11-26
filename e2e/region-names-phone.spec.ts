import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 714: on a phone the game's board names every region in full (it read 'Brindle' and 'Kings' while the cards
// said 'Brindle Hills'): each name 12 px or more on screen, inside the screen, and no plate or status disc meets another.
for (const [w, h] of [[390, 844], [360, 780], [430, 932]] as const) {
  test(`the phone board names every region in full at ${w}x${h}`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'phones only')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.map-wrap svg.map .region-sign').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(800)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll<SVGGElement>('.map-wrap svg.map .region-sign')].map((sign) => {
        const t = sign.querySelector<SVGTextElement>('.region-name')!
        const plate = sign.querySelector<SVGRectElement>('.region-plaque')!
        const pb = plate.getBoundingClientRect()
        const disc = sign.querySelector('[data-region-status]')?.getBoundingClientRect()
        const px = parseFloat(getComputedStyle(t).fontSize) * (pb.width / Number(plate.getAttribute('width')))
        const boxes = [pb, ...(disc ? [disc] : [])].map((b) => ({ l: b.left, r: b.right, t: b.top, b: b.bottom }))
        return { region: sign.getAttribute('data-sign')!, name: t.textContent, full: t.getAttribute('data-full'), shortened: t.hasAttribute('data-shortened'), px, boxes }
      }),
    )
    expect(r.length).toBe(7)
    for (const s of r) {
      expect(s.shortened, s.region).toBe(false)
      expect(s.name, s.region).toBe(s.full)
      expect(s.px, `${s.region} name px`).toBeGreaterThanOrEqual(12)
      for (const b of s.boxes) {
        expect(b.l, `${s.region} inside the screen`).toBeGreaterThanOrEqual(0)
        expect(b.r, `${s.region} inside the screen`).toBeLessThanOrEqual(w)
      }
    }
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        for (const a of r[i]!.boxes)
          for (const b of r[j]!.boxes) {
            const apart = a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t
            expect(apart, `${r[i]!.region} meets ${r[j]!.region}`).toBe(true)
          }
  })
}
