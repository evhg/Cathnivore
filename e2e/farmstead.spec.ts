import { test, expect } from '@playwright/test'

// Plan item 36: the farm as a farmstead. On a desktop the Farm is a fixed-height frame of drawn cards, so
// the Actions frame under it stays put as the farm grows; on a phone the Farm sheet lays every bought card
// out under the producer's gate and a ribbon of what the farm makes each round.

async function actionsTop(page: import('@playwright/test').Page) {
  return page.evaluate(() => Math.round(document.querySelector('.actions-sheet')!.getBoundingClientRect().top))
}

test('at D the Actions frame does not move between round 1 and a grown farm', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.actions-sheet').waitFor()
  const before = await actionsTop(page)

  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect.poll(() => page.locator('.stall-item').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
  expect(await actionsTop(page)).toBe(before)
})

test('the phone Farm shows each producer at their gate with a ribbon and drawn cards', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'phone layout')
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: /^Farm/ }).first().click()
  await expect(page.locator('.farm-sheet .farmstead-gate')).toHaveCount(2)
  await expect(page.locator('.farm-sheet .farmstead-ribbon').first()).toContainText('each round')
  await expect(page.locator('.farm-sheet .farmstead-card .card-vignette').first()).toBeVisible()
})

test('a buy flies the card into the farmstead and the tableau gains it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { flights: number }
    w.flights = 0
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.classList.contains('buy-flight')) w.flights++
    }).observe(document, { subtree: true, childList: true })
  })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const graft = () => page.getByRole('button', { name: /^Graft:/ }).click({ force: true })
  await graft()
  await graft()
  // Two Grafts put 4 Marks in hand, enough for most dealt Markets; a seed that deals none is skipped.
  // (Solo, so a buy never hands a hot-seat device over, where the flight is skipped under the pass screen.)
  const buyable = page.locator('[data-buy-card] button:enabled')
  test.skip((await buyable.count()) === 0, 'no affordable card dealt on this seed')
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024
  const button = buyable.first()
  const cardId = (await button.locator('xpath=ancestor::*[@data-buy-card][1]').getAttribute('data-buy-card'))!
  const inFarm = async () => {
    if (desktop) return page.locator(`.farm-inline .stall-item[data-card="${cardId}"]`).count()
    await page.getByRole('button', { name: /^Farm/ }).first().click()
    const n = await page.locator(`.farm-sheet .farmstead-card[data-card="${cardId}"]`).count()
    await page.getByRole('button', { name: 'Close' }).click()
    return n
  }
  expect(await inFarm()).toBe(0)
  await button.click({ force: true })
  await expect.poll(() => page.evaluate(() => (window as unknown as { flights: number }).flights)).toBe(1)
  // Plan item 53: a coin chinks for each Mark counted out.
  expect(await page.evaluate(() => (window as unknown as { __cathnivoreSound: { log: string[] } }).__cathnivoreSound.log.filter((c) => c === 'coinOne').length)).toBeGreaterThan(0)
  await page.waitForTimeout(900)
  expect(await inFarm()).toBe(1)
  // Plan item 62: on the stall the crate sits on its tag's shelf (fields, sea or town).
  if (!desktop) await page.getByRole('button', { name: /^Farm/ }).first().click()
  const crate = page.locator(`${desktop ? '.farm-inline' : '.farm-sheet'} .stall-item[data-card="${cardId}"]`).first()
  const [tag, shelf] = [await crate.getAttribute('data-tag'), await crate.getAttribute('data-shelf')]
  const want = { pasture: 'fields', crop: 'fields', coast: 'sea' }[tag ?? ''] ?? 'town'
  expect(shelf).toBe(want)
})
