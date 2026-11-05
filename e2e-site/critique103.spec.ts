import { expect, test } from '@playwright/test'

// Plan item 103: the bugs from the 2026-11-04 12:25 critique (e2e/screenshots/plan1104c), one case each at P and D.

const save20 = () => {
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, seen: {}, tips: { all: true } }))
}

test("Hedgerow map: the level card's stars read at 18 px or more, and no vehicle name wraps", async ({ page, hasTouch }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(save20)
  await page.goto('/hedgerow/?2d')
  const card = page.locator('#screen-select .level-card')
  await expect(card).toBeVisible({ timeout: 30_000 })
  const stars = await card.locator('.lcard-stars').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(stars).toBeGreaterThanOrEqual(18)
  if (hasTouch) return // the phone sheet leaves the vehicles off
  const rows = await card.locator('.lcard-enemies li').evaluateAll((lis) =>
    lis.map((li) => ({ h: li.getBoundingClientRect().height, text: li.textContent, top: li.getBoundingClientRect().top })),
  )
  expect(rows.length).toBeGreaterThan(0)
  for (const r of rows) expect(r.h, r.text ?? '').toBeLessThanOrEqual(30)
  // A fourth vehicle sits in the grid's second column, never alone on a row of its own.
  if (rows.length === 4) expect(Math.abs(rows[3]!.top - rows[2]!.top)).toBeLessThanOrEqual(1)
})

test('Cathnivore game: no playable action card cuts its label', async ({ page }) => {
  for (const seed of ['103', '2103', '31030']) {
    await page.goto('/cathnivore/')
    await page.getByText('Quick Game').click()
    const adv = page.getByRole('button', { name: 'Advanced' })
    // isVisible() doesn't wait: let the setup render before asking whether the seed is folded behind the chip.
    await page.getByLabel('Seed (optional)').waitFor({ state: 'attached' })
    if ((await adv.isVisible()) && (await adv.getAttribute('aria-expanded')) !== 'true') await adv.click()
    await page.getByLabel('Seed (optional)').fill(seed)
    await page.getByRole('button', { name: 'Start' }).click()
    // Plan item 149: on a big desktop the playable cards are the hand at the table's edge, not the Actions list.
    const labels = page.locator(':is(.actions, .table-hand) .action-item > button:not(:disabled) .action-label')
    await expect(labels.first()).toBeAttached({ timeout: 15_000 })
    const cut = await labels.evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent),
    )
    expect(cut, seed).toEqual([])
  }
})

test("Cathnivore title: the minor tags carry no radio-like ring, and their labels read at 11 px or more", async ({ page, hasTouch }) => {
  await page.goto('/cathnivore/')
  const tags = page.locator('.title-minor .quiet')
  await expect(tags).toHaveCount(3)
  const out = await tags.evaluateAll((els) =>
    els.map((el) => ({
      ring: getComputedStyle(el, '::before').content,
      font: parseFloat(getComputedStyle(el).fontSize),
      icon: (() => {
        const svg = el.querySelector('svg')
        return svg && getComputedStyle(svg).display !== 'none' ? svg.getBoundingClientRect().width : 0
      })(),
    })),
  )
  for (const o of out) {
    expect(o.ring === 'none' || o.ring === 'normal' || o.ring === '').toBe(true)
    expect(o.font).toBeGreaterThanOrEqual(11)
    if (!hasTouch) expect(o.icon).toBeGreaterThanOrEqual(14)
  }
})
