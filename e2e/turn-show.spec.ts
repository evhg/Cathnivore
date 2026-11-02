import { test, expect, type Page } from '@playwright/test'

// Plan item 34: the turns between yours are a show. The AI teammate lifts each pick as a card with its
// reason before it lands (`data-teammate-step`), and a tap skips the rest of their turn; the enemy turn
// docks in the Actions area as a ledger that ticks off. Neither covers a hex or leaves an empty band.

const SAVE_KEY = 'cathnivore:save:v1'

async function graft(page: Page) {
  await page.getByRole('button', { name: /^Graft:/ }).click({ force: true })
}

async function startSolo(page: Page) {
  // Record, the moment each pick card appears, how many actions the save holds: the reason must be on
  // show before the pick changes the state.
  await page.addInitScript((key) => {
    const w = window as unknown as { picks: { reason: string; actions: number }[] }
    w.picks = []
    new MutationObserver(() => {
      const el = document.querySelector('[data-teammate-step]')
      const reason = el?.getAttribute('data-teammate-step')
      if (!reason) return
      const last = w.picks[w.picks.length - 1]
      const actions = JSON.parse(localStorage.getItem(key) ?? '{"actions":[]}').actions.length
      if (!last || last.actions !== actions) w.picks.push({ reason, actions })
    }).observe(document, { subtree: true, childList: true, attributes: true })
  }, SAVE_KEY)
  await page.goto('/?e2eTeammateShow=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  for (let i = 0; i < 3; i++) await graft(page)
}

// The boxes in the Actions area during a turn: none may cross a hex, and no vertical band of the area
// taller than 120 px may be left empty.
async function measure(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const panel = document.querySelector(sel)!
    const p = panel.getBoundingClientRect()
    const hits = [...document.querySelectorAll('.region-hex polygon')]
      .map((h) => h.getBoundingClientRect())
      .filter((t) => t.width > 40 && t.left < p.right && t.right > p.left && t.top < p.bottom && t.bottom > p.top).length
    const area = panel.closest('.actions')!.getBoundingClientRect()
    const boxes = [...panel.querySelectorAll('*')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .sort((a, b) => a.top - b.top)
    let reach = area.top
    let gap = 0
    for (const r of boxes) {
      gap = Math.max(gap, r.top - reach)
      reach = Math.max(reach, r.bottom)
    }
    gap = Math.max(gap, area.bottom - reach)
    return { hits, gap: Math.round(gap), clipped: panel.scrollHeight > panel.clientHeight + 1 }
  }, selector)
}

test("the teammate's picks show with their reasons before they land, and a tap skips the rest", async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await startSolo(page)

  const pick = page.locator('.teammate-pick[data-teammate-step]')
  await expect(pick).toBeVisible({ timeout: 15_000 })
  await expect(pick.locator('.teammate-card-reason')).not.toBeEmpty()
  const m = await measure(page, '.teammate-pick')
  expect(m.hits).toBe(0)
  expect(m.gap).toBeLessThanOrEqual(120)
  expect(m.clipped).toBe(false)

  // The first pick shows while the save still holds only Mara's three moves; then it lands.
  await expect.poll(() => page.evaluate(() => (window as unknown as { picks: unknown[] }).picks.length)).toBeGreaterThan(0)
  const first = await page.evaluate(() => (window as unknown as { picks: { reason: string; actions: number }[] }).picks[0]!)
  expect(first.actions).toBe(3)
  expect(first.reason.length).toBeGreaterThan(5)
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).actions.length, SAVE_KEY), { timeout: 10_000 })
    .toBeGreaterThan(3)

  // A tap skips the rest of their turn: it ends at once, with no further card.
  await expect(pick).toBeVisible({ timeout: 15_000 })
  const shown = await page.evaluate(() => (window as unknown as { picks: unknown[] }).picks.length)
  await pick.click()
  await expect(page.locator('.teammate-pick, .teammate-thinking')).toHaveCount(0, { timeout: 5_000 })
  expect(await page.evaluate(() => (window as unknown as { picks: unknown[] }).picks.length)).toBe(shown)
  expect(errors).toEqual([])
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the pick card fades in instead of lifting', async ({ page }) => {
    await startSolo(page)
    const card = page.locator('.teammate-pick .teammate-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe('boardroom-fade')
  })
})

test('the enemy turn is a ledger that ticks off in the Actions area', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByLabel('Hot-seat (two humans)').check()
  await page.getByRole('button', { name: 'Start' }).click()
  for (let i = 0; i < 3; i++) await graft(page)
  await page.getByRole('button', { name: "I'm ready" }).click()
  for (let i = 0; i < 3; i++) await graft(page)
  await expect(page.locator('.enemy-turn-playback.boardroom')).toBeVisible()

  const ledger = page.locator('.boardroom-ledger li')
  const steps = await ledger.count()
  expect(steps).toBeGreaterThan(1)
  await expect(page.locator('.boardroom-ledger li.now')).toHaveCount(1)
  await page.waitForTimeout(500) // past the card's flip-in
  const m = await measure(page, '.enemy-turn-playback')
  expect(m.hits).toBe(0)
  expect(m.gap).toBeLessThanOrEqual(120)
  expect(m.clipped).toBe(false)
  await expect(page.locator('.boardroom-ledger li.done')).toHaveCount(1, { timeout: 3_000 })
  await expect(page.locator('.boardroom-ledger li.done')).toHaveCount(2, { timeout: 3_000 })
})
