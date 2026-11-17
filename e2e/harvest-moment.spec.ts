import { test, expect } from '@playwright/test'

// Plan item 476: when a round closes, the Harvest pays out on the table: one painted good per unit the engine
// paid rises from its producer's home hex and arcs to that producer's bust, in 900-1600 ms; a tap ends it at once.
test('the Harvest flies each good from the land to its producer', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const moment = page.locator('[data-moment="harvest"]')
  await expect(moment).toBeVisible({ timeout: 90_000 })
  const goods = moment.locator('[data-harvest-good]')
  const n = await goods.count()
  expect(n).toBeGreaterThan(0)
  expect(Number(await moment.getAttribute('data-goods'))).toBe(n)
  const ms = Number(await moment.getAttribute('data-duration'))
  expect(ms).toBeGreaterThanOrEqual(900)
  expect(ms).toBeLessThanOrEqual(1600)
  // Every good belongs to a seated producer whose bust is on the table, and is one of the three goods.
  const seated = await page.locator('[data-table-producer]').evaluateAll((els) => els.map((e) => e.getAttribute('data-table-producer')))
  for (const g of await goods.evaluateAll((els) => els.map((e) => ({ unit: e.getAttribute('data-harvest-good'), pid: e.getAttribute('data-producer') })))) {
    expect(['produce', 'marks', 'goodwill']).toContain(g.unit)
    expect(seated).toContain(g.pid)
  }
  // A tap anywhere ends it.
  const t0 = Date.now()
  // (a pointerdown on the page, as a tap starts: a real click could land on a control)
  await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await expect(moment).toHaveCount(0, { timeout: 1000 })
  expect(Date.now() - t0).toBeLessThan(1000)
})
