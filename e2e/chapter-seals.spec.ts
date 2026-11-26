import { test, expect, type Page } from '@playwright/test'

// Plan item 477: in a campaign game the chapter's three seals sit on the table, each reading its outlook live
// (open, on track, at risk, lost, sealed), so the feat is a goal while you play; Quick games have none.
async function startChapter(page: Page, title: string, until: number) {
  await page.goto(`/?e2eAutoplay=1&e2eAutoplayUntil=${until}`)
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click()
  const solo = page.getByRole('button', { name: /^Solo/ })
  if (await solo.isVisible().catch(() => false)) await solo.click()
  await page.getByRole('button', { name: 'Continue' }).click()
}

const seals = (page: Page) => page.locator('[data-seal-card] summary [data-seal]')

test('the chapter seals read on the table and open to their labels', async ({ page }) => {
  await startChapter(page, 'Word of Mouth', 2)
  await expect(seals(page)).toHaveCount(3, { timeout: 60_000 })
  expect(await seals(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-seal')))).toEqual(['win', 'hard', 'feat'])
  // Round 2 of a Normal game: the win still open, the Hard seal not on offer, the round-5 feat on track.
  await expect(page.locator('[data-seal-card] summary [data-seal="feat"]')).toHaveAttribute('data-state', 'onTrack')
  await expect(page.locator('[data-seal-card] summary [data-seal="hard"]')).toHaveAttribute('data-state', 'open')
  const card = page.locator('[data-seal-card] > summary')
  await card.click()
  await expect(page.locator('.seal-list')).toBeVisible()
  await expect(page.locator('.seal-list')).toContainText('Won by round 5')
  // The card stays inside the table.
  const inside = await page.evaluate(() => {
    const a = document.querySelector('.map-wrap')!.getBoundingClientRect()
    const b = document.querySelector('[data-seal-card] > summary')!.getBoundingClientRect()
    return b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom
  })
  expect(inside).toBe(true)
})

test('a round feat cracks once its round has passed', async ({ page }) => {
  test.setTimeout(150_000)
  await startChapter(page, 'Word of Mouth', 6)
  const feat = page.locator('[data-seal-card] summary [data-seal="feat"]')
  const end = page.locator('.end-screen')
  await expect(feat.or(end).first()).toBeVisible({ timeout: 60_000 })
  // Autoplay stops at round 6, unless the chapter was won (or lost) before it.
  await expect(page.locator('[data-meter="round"]').getByText(/^6/).or(end).first()).toBeVisible({ timeout: 120_000 })
  if (await end.isVisible()) test.skip(true, 'the chapter ended before round 6 on this seed')
  await expect(feat).toHaveAttribute('data-state', 'lost')
})

test('a Quick game has no seals on the table', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.map-wrap')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-seal-card]')).toHaveCount(0)
})

test('a won chapter stamps the seals it kept, in order, matching what the campaign records', async ({ page }) => {
  test.setTimeout(150_000)
  await startChapter(page, 'Word of Mouth', 99)
  const end = page.locator('.end-screen')
  await expect(end).toBeVisible({ timeout: 120_000 })
  if ((await page.locator('.end-screen.is-win').count()) === 0) test.skip(true, 'the bot lost this seed')
  await expect(page.locator('[data-end-seal]')).toHaveCount(3)
  const stamped = await page.locator('[data-end-seal][data-stamp]').evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute('data-end-seal'), n: Number(e.getAttribute('data-stamp')) })).sort((a, b) => a.n - b.n).map((x) => x.id),
  )
  expect(stamped[0]).toBe('win')
  await page.getByRole('button', { name: 'Continue' }).click()
  const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem('cathnivore:campaign:v1') ?? '{}').seals?.['word-of-mouth'] ?? [])
  expect(stamped).toEqual(['win', 'hard', 'feat'].filter((s) => recorded.includes(s)))
})

// CI E2E red on 312b609a (tutorial desktop): at 1440x900 item 708's ledger took the cloth's top-left, where the seal
// card sat, so the card covered the readings and took the Menu key's click; it hangs under the ledger now. On an
// upright phone the card stood at the wrap's foot, under Cath's dock, hidden whole; it stands above the dock now.
for (const [w, h] of [[1440, 900], [390, 844], [375, 667]] as const) {
  test(`at ${w}x${h} the seal card is on top, clear of the ledger, and the Menu key takes a click`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one browser sets each size')
    await page.setViewportSize({ width: w, height: h })
    await startChapter(page, 'Word of Mouth', 2)
    await expect(seals(page)).toHaveCount(3, { timeout: 60_000 })
    const m = await page.evaluate(() => {
      const box = (s: string) => { const b = document.querySelector(s)!.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }
      const card = box('[data-seal-card] > summary')
      const top = document.elementFromPoint((card.l + card.r) / 2, (card.t + card.b) / 2)?.closest('[data-seal-card]') !== null
      return { card, top, ledger: box('.market-board') }
    })
    const meet = (a: typeof m.card, b: typeof m.card) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    expect(m.top, 'the seal card is the top element at its centre').toBe(true)
    expect(meet(m.card, m.ledger), 'seal card and ledger').toBe(false)
    await page.getByRole('button', { name: 'Menu' }).click({ trial: true, timeout: 5_000 })
  })
}
