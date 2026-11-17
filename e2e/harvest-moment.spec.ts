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
  // The active producer's counts hold back what is still in flight, so they read no higher during the moment than
  // after it (where they show the engine's totals).
  const ledger = () => page.locator('[data-ledger-unit] .ledger-value').evaluateAll((els) => els.map((e) => Number(e.textContent)))
  const during = await ledger()
  // A tap anywhere ends it.
  const t0 = Date.now()
  // (a pointerdown on the page, as a tap starts: a real click could land on a control)
  await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await expect(moment).toHaveCount(0, { timeout: 1000 })
  expect(Date.now() - t0).toBeLessThan(1000)
  const after = await ledger()
  expect(after.length).toBe(during.length)
  after.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(during[i]!))
})

// Each good lands with its sound (a crate's wood, a Mark's coin, a rosette's paper), and a producer whose haul is
// three goods or more lights up at the table as the last one lands.
test('the Harvest lands with its sounds and a big haul delights its producer', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const moment = page.locator('[data-moment="harvest"]')
  await expect(moment).toBeVisible({ timeout: 90_000 })
  const goods = await moment.locator('[data-harvest-good]').evaluateAll((els) => els.map((e) => ({ unit: e.getAttribute('data-harvest-good')!, pid: e.getAttribute('data-producer')! })))
  const count = new Map<string, number>()
  for (const g of goods) count.set(g.pid, (count.get(g.pid) ?? 0) + 1)
  const big = [...count].filter(([, n]) => n >= 3).map(([p]) => p)
  if (big.length > 0) await expect(page.locator(`[data-table-producer="${big[0]}"][data-expression="delighted"]`).first()).toBeAttached({ timeout: 8000 })
  await expect(moment).toHaveCount(0, { timeout: 8000 })
  const log = await page.evaluate(() => (window as unknown as { __cathnivoreSound: { log: string[] } }).__cathnivoreSound.log)
  const want = { produce: 'woodClack', marks: 'coinOne', goodwill: 'paperFlip' } as Record<string, string>
  // (close landings share one sound, so only the first good's is certain)
  expect(log).toContain(want[goods[0]!.unit])
})
