import { test, expect } from '@playwright/test'

// Plan item 263: on a phone the Market sheet shows a card it can't yet buy with a coin meter (the Marks held toward
// its price, a count at 12 px or more), not a red sentence, and every card says whether its price is met.
test('the Market sheet: coin meters and data-affordable', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 900, 'the phone Market sheet')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.getByRole('button', { name: /^Market/ }).first().click()
  const cards = page.locator('.card-list [data-buy-card]')
  await expect(cards.first()).toBeVisible()
  const rows = await cards.evaluateAll((els) =>
    els.map((e) => {
      const m = e.querySelector<HTMLElement>('.card-meter')
      const count = m?.querySelector<HTMLElement>('.card-meter-count')
      return {
        affordable: e.getAttribute('data-affordable'),
        buy: !!e.querySelector('button'),
        meter: !!m,
        now: m ? Number(m.getAttribute('aria-valuenow')) : null,
        max: m ? Number(m.getAttribute('aria-valuemax')) : null,
        text: count?.textContent ?? '',
        font: count ? parseFloat(getComputedStyle(count).fontSize) : 0,
      }
    }),
  )
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.some((r) => r.meter)).toBe(true)
  for (const r of rows) {
    expect(['true', 'false']).toContain(r.affordable)
    if (r.meter) {
      expect(r.affordable).toBe('false')
      expect(r.max!).toBeGreaterThan(r.now!)
      expect(r.text).toBe(`${r.now} of ${r.max} Marks`)
      expect(r.font).toBeGreaterThanOrEqual(12)
    }
  }
  await expect(page.locator('.card-list .card-why-not')).toHaveCount(0)
})
