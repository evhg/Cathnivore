import { openPapers } from './papers'
import { test, expect } from '@playwright/test'

// Plan item 173: Hollowell's moves are its own glossy dashboard: the row carries data-corp, its cards draw no
// paper texture (no image, only gradients), and the region chips read at 4.5:1 or more.
test('the plan strip is Hollowell\'s acrylic dashboard', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await openPapers(page)
  const strip = page.locator('.plan-strip[data-corp]')
  await expect(strip).toBeVisible()
  const cards = strip.locator('.plan-strip-item > button:first-child')
  await expect(cards).toHaveCount(3)
  for (const c of await cards.all()) {
    const bg = await c.evaluate((e) => getComputedStyle(e).backgroundImage)
    expect(bg).not.toMatch(/url\(/)
    expect(await c.evaluate((e) => getComputedStyle(e.parentElement!).rotate)).toMatch(/^(none|0deg)$/)
  }
  const chips = strip.locator('.plan-chip')
  expect(await chips.count()).toBeGreaterThan(0)
  const ratios = await chips.evaluateAll((els) => {
    const rgb = (c: string): number[] => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number)
      return c.startsWith('color(') ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3)
    }
    const lum = (c: string) => {
      const [r, g, b] = rgb(c).map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    return els.map((e) => {
      const s = getComputedStyle(e)
      const [a, b] = [lum(s.color), lum(s.backgroundColor)]
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
  })
  for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5)
})
