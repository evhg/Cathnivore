import { expect, test } from '@playwright/test'

// Plan item 725: at D the rail is one almanac page, not form controls: the streak is Bea's pressed flowers (one pressed
// per day kept), the dailies watered and the best run drawn with their numbers, each with its words as its accessible
// name; the fold's tab is the week's beds with a page corner, not a select-like box with a caret; its text passes AA.
test('the desktop rail is an almanac page, not a form', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width < 1100, 'the desktop rail')
  const results: Record<string, unknown> = {}
  for (const d of ['2026-11-24', '2026-11-25', '2026-11-26']) results[d] = { number: 1, timeMs: 90000, taps: 80, par: 85 }
  await page.clock.setFixedTime(new Date('2026-11-27T10:00:00Z'))
  await page.addInitScript((r) => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: r, bestPractice: {}, practiceSolved: 0, seenHelp: true })), results)
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#rail')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Current streak: 3 days' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Dailies solved: 3' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Best streak: 3 days' })).toBeVisible()
  await expect(page.locator('.al-streak .pf')).toHaveCount(7)
  await expect(page.locator('.al-streak .pf.kept')).toHaveCount(3)
  await expect(page.getByRole('img', { name: 'This week: 3 of 7 days watered' })).toBeVisible()
  await expect(page.locator('#rail-more-week .mw')).toHaveCount(7)
  await expect(page.locator('#rail-more-week .mw svg.ga')).toHaveCount(3)
  const tab = await page.locator('#rail-more > summary').evaluate((s) => {
    const cs = getComputedStyle(s)
    const after = getComputedStyle(s, '::after')
    return { radius: parseFloat(cs.borderTopLeftRadius), bg: cs.backgroundColor, shadow: cs.boxShadow, caret: after.content }
  })
  // no box (rounded, filled, ringed) and no caret glyph: a select's idioms
  expect(tab.caret).not.toMatch(/[▾▴▼▲]/)
  expect(tab.shadow).toBe('none')
  expect(tab.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  // the words on the page pass AA against the rail's paper
  const worst = await page.evaluate(() => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
    }
    let bgEl: Element | null = document.querySelector('#rail')
    let bg = 'rgba(0, 0, 0, 0)'
    while (bgEl && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
      bg = getComputedStyle(bgEl).backgroundColor
      bgEl = bgEl.parentElement
    }
    const lb = lum(parse(bg))
    let min = 99
    for (const el of document.querySelectorAll<HTMLElement>('.rail-figures b, .rail-figures span:last-child, .rail-more-tab > span:first-child, #rail-more-week b')) {
      const lf = lum(parse(getComputedStyle(el).color))
      min = Math.min(min, (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05))
    }
    return min
  })
  expect(worst).toBeGreaterThanOrEqual(4.5)
})
