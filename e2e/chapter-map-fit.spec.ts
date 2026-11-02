import { test, expect } from '@playwright/test'

// Plan item 33: chapter 1 opens only two hexes of the ring. They are centred on the table and drawn
// larger, not left in the ring's top-left corner at the full board's scale.
test('chapter 1\'s two hexes are centred and scaled up on the table', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('.coach').waitFor()
  const m = await page.evaluate(() => {
    const svg = document.querySelector('svg.map')!.getBoundingClientRect()
    const tiles = [...document.querySelectorAll('.region-hex polygon')].map((p) => p.getBoundingClientRect()).filter((r) => r.width > 40)
    const left = Math.min(...tiles.map((t) => t.left))
    const right = Math.max(...tiles.map((t) => t.right))
    const top = Math.min(...tiles.map((t) => t.top))
    const bottom = Math.max(...tiles.map((t) => t.bottom))
    const side = Math.min(svg.width, svg.height)
    return {
      dx: Math.abs((left + right) / 2 - (svg.left + svg.right) / 2) / side,
      dy: Math.abs((top + bottom) / 2 - (svg.top + svg.bottom) / 2) / side,
      tall: (bottom - top) / side,
      inside: left >= svg.left - 1 && right <= svg.right + 1 && top >= svg.top - 1 && bottom <= svg.bottom + 1,
    }
  })
  expect(m.dx).toBeLessThan(0.06)
  expect(m.dy).toBeLessThan(0.06)
  expect(m.tall).toBeGreaterThan(0.8)
  expect(m.inside).toBe(true)
})
