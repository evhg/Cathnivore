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

// Plan item 126: the Up-next title wraps only at its dot, never inside the date ("Wed, Nov / 4").
test('the Up-next title keeps its date on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/runnel/?lesson')
  const title = page.locator('#lc-next b')
  await expect(title).toBeVisible()
  const r = await title.evaluate((b) => {
    // Plan item 138: the number on its own line, then the date; no line ends on a dot, and the date's glyph boxes
    // share one top.
    const rest = b.querySelector('.unt-rest')!
    const text = rest.firstChild as Text
    const at = text.data.indexOf('·')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, at < 0 ? text.length : at)
    const dateLines = new Set([...range.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top))).size
    return { dateLines, head: b.querySelector('.unt-head')?.textContent ?? '' }
  })
  expect(r.dateLines).toBe(1)
  expect(r.head).toMatch(/^Daily\s#\d+$/)
})
