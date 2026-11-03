import { expect, test } from '@playwright/test'

// Plan item 79: the bugs from the 2026-11-03 15:25 critique (e2e/screenshots/plan1103f), one case each.

test('Hedgerow D: a long vehicle name keeps its round-card pill inside the column', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the round card is the desktop side column')
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  const chips = page.locator('.panel .ticket-chips .preview-chip')
  await expect(chips.first()).toBeVisible()
  const out = await page.evaluate(() =>
    [...document.querySelectorAll('.panel .ticket-chips .preview-chip')].map((li) => {
      const r = li.getBoundingClientRect()
      const row = li.parentElement!.getBoundingClientRect()
      const name = li.querySelector('.chip-name')!.getBoundingClientRect()
      return { pill: r.right - row.right, name: name.right - r.right, text: li.textContent }
    }),
  )
  for (const o of out) {
    expect(o.pill, o.text ?? '').toBeLessThanOrEqual(0.5)
    expect(o.name, o.text ?? '').toBeLessThanOrEqual(0.5)
  }
})
