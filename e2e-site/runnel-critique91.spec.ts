import { expect, test } from '@playwright/test'

// Plan item 91 (the 2026-11-04 04:10 critique): under the lesson the footer's hint doesn't repeat Up next's sky
// line, and the lesson's steps still to come read at 4.5:1 or more.
test('the lesson: no repeated sky line, and its steps at AA', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the lesson column at D')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/runnel/?lesson')
  await expect(page.locator('#lesson-card')).toBeVisible()
  const sky = page.locator('#lc-next > span:last-child > span')
  await expect(sky).toBeVisible()
  const label = (await sky.textContent())!.trim()
  expect(label.length).toBeGreaterThan(3)
  await expect(page.locator('#hint')).not.toContainText(label)
  const ratios = await page.evaluate(() => {
    const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
    const lum = (c: string) => {
      const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
    }
    return [...document.querySelectorAll('.lc-steps li:not(.now)')].map((li) => {
      const s = getComputedStyle(li)
      const [a, b] = [lum(s.color), lum(s.backgroundColor)]
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
  })
  expect(ratios.length).toBeGreaterThan(0)
  for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5)
})
