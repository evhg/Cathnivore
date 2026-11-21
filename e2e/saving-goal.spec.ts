import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 183: the Not-yet shelf as a savings goal. At D the shelf shows one row (3 cards or fewer) with a key
// for the rest; pinning a priced card puts it first with a jar whose meter is the coins held toward its price, and
// the goal survives a reload through the save.
test('the Not-yet shelf folds to one row, and a pinned goal fills its jar and survives a reload', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the shelf is the big desktop column')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const shelfCards = page.locator('.actions[data-shelf] .action-item[data-later-idx]')
  await expect(page.locator('.shelf-fold')).toBeVisible()
  const total = await shelfCards.count()
  const shown = () => page.locator('.actions[data-shelf] .action-item[data-later-idx]:visible').count()
  // Plan item 589: the shelf is one Saving-for card, its goal on top and every shelf card behind the key.
  expect(await shown()).toBe(0)
  await expect(page.locator('.goal-feature')).toBeVisible()
  await expect(page.locator('.shelf-fold')).toHaveText(`${total} on the shelf`, { useInnerText: true })
  await page.locator('.shelf-fold').click()
  expect(await shown()).toBe(total)

  // Pin the second priced card: it moves to the front, lit, with its jar.
  const pin = page.locator('.shelf-pin').nth(1)
  const name = (await pin.getAttribute('aria-label'))!.replace(/^Save for /, '')
  await pin.click()
  const section = page.locator('.actions[data-shelf]')
  const goal = await section.getAttribute('data-saving-for')
  expect(goal).toMatch(/^(invest|scheme):/)
  const first = page.locator('.action-item[data-later-idx="0"]')
  await expect(first).toHaveAttribute('data-saving-goal', '')
  await expect(first.locator('.shelf-pin')).toHaveAttribute('aria-pressed', 'true')
  const jar = first.locator('.saving-jar[role="meter"]')
  await expect(jar).toBeVisible()
  const now = Number(await jar.getAttribute('aria-valuenow'))
  const max = Number(await jar.getAttribute('aria-valuemax'))
  expect(max).toBeGreaterThan(now)
  await expect(jar).toHaveAttribute('aria-label', `Saving for ${name}: ${now} of ${max} ${goal!.startsWith('invest') ? 'Marks' : 'Goodwill'}`)
  // Its text stays 12 px or more and the jar, pin and reason don't meet.
  const m = await first.evaluate((el) => {
    const r = (s: string) => el.querySelector(s)!.getBoundingClientRect()
    const meet = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    return { font: parseFloat(getComputedStyle(el.querySelector('.jar-count')!).fontSize), jarWhy: meet(r('.saving-jar'), r('.action-why-not')), pinWhy: meet(r('.shelf-pin'), r('.action-why-not')) }
  })
  expect(m.font).toBeGreaterThanOrEqual(12)
  expect(m.jarWhy).toBe(false)
  expect(m.pinWhy).toBe(false)

  // The goal round-trips through the save.
  await page.reload()
  const cont = page.getByRole('button', { name: /Continue/ }).first()
  await cont.click()
  await expect(page.locator('.actions[data-shelf]')).toHaveAttribute('data-saving-for', goal!)
  // closed again after the reload, its goal on the card; the key opens the shelf
  await expect(page.locator('.goal-feature')).toHaveAttribute('data-pinned', '')
  await page.locator('.shelf-fold').click()
  await expect(page.locator('.action-item[data-later-idx="0"] .saving-jar')).toBeVisible()
  expect(await shown()).toBe(total)

  // Unpinning clears the goal.
  await page.locator('.shelf-pin[aria-pressed="true"]').click()
  await expect(page.locator('.actions[data-shelf]')).not.toHaveAttribute('data-saving-for', /./)
})

// Plan item 589 (was item 548's second row): on a tall desktop the closed Saving-for card takes the rail's spare
// height, so no bare stretch over 40 px opens between it and the ledger, before or after the ledger's first line.
for (const [width, height] of [[1440, 1000], [1920, 1080]] as const) test(`the closed Saving-for card fills the rail (${width}x${height})`, async ({ page, isMobile }) => {
  test.skip(isMobile, 'the shelf is the big desktop column')
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.goal-feature')).toBeVisible()
  const gap = () =>
    page.evaluate(() => {
      const fold = document.querySelector('.actions-sheet .shelf-fold')!.getBoundingClientRect()
      const ledger = document.querySelector('.actions-sheet .round-ledger')!.getBoundingClientRect()
      return ledger.top - fold.bottom
    })
  expect(await gap()).toBeLessThanOrEqual(40)
  const sell = page.locator('.table-hand [data-group="sell"]')
  await sell.getByRole('button', { name: '1 to sell' }).click()
  await sell.getByRole('button', { name: /^Sell 1 Produce/ }).click()
  await expect(page.locator('.actions-sheet .round-ledger')).not.toHaveAttribute('data-empty', /.*/)
  expect(await gap()).toBeLessThanOrEqual(40)
})

test('a goal that becomes affordable lifts into the hand within 800 ms and the pin comes off', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the shelf is the big desktop column')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  // (plan item 589: the shelf's cards wait behind the Saving-for card's key)
  await page.locator('.shelf-fold').click()
  await expect(page.locator('.shelf-pin').first()).toBeVisible()
  // An Invest card short by 3 Marks or fewer; selling that much Produce pays for it.
  const target = page.locator('.action-item.action-invest[data-later-idx]').filter({ hasText: /Need [123] more Marks?/ }).first()
  test.skip((await target.count()) === 0, 'no Invest card within three Marks on this seed')
  const short = Number((await target.locator('.action-why-not').innerText()).match(/Need (\d)/)![1])
  const id = (await target.locator('.shelf-pin').getAttribute('aria-label'))!.replace(/^Save for /, '')
  await target.locator('.shelf-pin').click()
  await expect(page.locator('[data-goal-line]')).toContainText(`Still saving for ${id}: ${short} more`)
  // Plan item 384: one Sell card; pick the count on its coins, then play its face.
  const sell = page.locator('.table-hand [data-group="sell"]')
  await sell.getByRole('button', { name: `${short} to sell` }).click()
  await sell.getByRole('button', { name: new RegExp(`^Sell ${short} Produce`) }).click()
  const t0 = Date.now()
  const lifted = page.locator('.table-hand [data-group="invest"][data-goal-lift]')
  await expect(lifted).toBeVisible({ timeout: 800 })
  expect(Date.now() - t0).toBeLessThan(800)
  await expect(lifted).toContainText(id)
  await expect(page.locator('.actions[data-shelf]')).not.toHaveAttribute('data-saving-for', /./, { timeout: 3000 })
})

test('on a phone the pile card takes the pin and the goal is a jar chip on the mat row', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const card = page.locator('.action-tray .action-head-later ~ .action-item:has(.shelf-pin)').first()
  await card.scrollIntoViewIfNeeded()
  await card.locator('.tooltip-trigger-button').focus()
  const pin = card.locator('.shelf-pin')
  await expect(pin).toBeVisible()
  const name = (await pin.getAttribute('aria-label'))!.replace(/^Save for /, '')
  await pin.click()
  await expect(pin).toHaveAttribute('aria-pressed', 'true')
  const chip = page.locator('.active-producer > .goal-chip[role="meter"]')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveAttribute('aria-label', new RegExp(`^Saving for ${name}: \\d+ of \\d+ (Marks|Goodwill)$`))
  const m = await page.evaluate(() => {
    const c = document.querySelector('.goal-chip')!.getBoundingClientRect()
    const row = document.querySelector('.active-producer')!.getBoundingClientRect()
    const meets = (sel: string) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom })
    return { inside: c.left >= 0 && c.right <= innerWidth, onRow: c.bottom > row.top && c.top < row.top + 4, hitsLedger: meets('.ledger-chip'), hitsPips: meets('.pips'), font: parseFloat(getComputedStyle(document.querySelector('.goal-chip .jar-count')!).fontSize) }
  })
  expect(m).toEqual({ inside: true, onRow: true, hitsLedger: false, hitsPips: false, font: m.font })
  expect(m.font).toBeGreaterThanOrEqual(12)
})

// Plan item 549: at 1440x900 the band under the shelf's one row holds the goal shown large (its picture, name and a
// fill of the coins held), so the rail has no bare gap over 40 px; the mat's resource pictures are 48 px or more.
test('the rail shows the goal large in the band under the shelf, and its fill matches the coins held (1440x900)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the shelf is the big desktop column')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const feature = page.locator('.goal-feature')
  await expect(feature).toBeVisible()
  // Item 586: with nothing pinned it invites a pin instead of repeating the nearest card shown in the row.
  await expect(feature).toHaveAttribute('data-empty', '')
  await expect(feature.locator('.goal-feature-name')).toHaveText('Nothing yet')
  // Pin the second priced card (the shelf opened from the card's key, then folded): the card shows it, its fill is
  // held / price.
  await page.locator('.shelf-fold').click()
  const pin = page.locator('.shelf-pin').nth(1)
  const name = (await pin.getAttribute('aria-label'))!.replace(/^Save for /, '')
  await pin.click()
  await page.locator('.shelf-fold').click()
  await expect(feature).toHaveAttribute('data-pinned', '')
  await expect(feature.locator('.goal-feature-name')).toHaveText(name)
  const m = await page.evaluate(() => {
    const f = document.querySelector('.goal-feature')!
    const meter = f.querySelector('.goal-feature-meter')!
    const fill = f.querySelector('.goal-feature-fill')!.getBoundingClientRect()
    const track = meter.getBoundingClientRect()
    // the rail's visible pieces, top to bottom
    const sheet = document.querySelector('.actions-sheet')!
    const parts = [...sheet.querySelectorAll('.action-head-later, .action-item[data-later-idx], .shelf-fold, .goal-feature, .round-ledger, .round-ledger ~ *')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .sort((a, b) => a.top - b.top)
    let bottom = parts[0]!.bottom
    let gap = 0
    for (const r of parts.slice(1)) {
      gap = Math.max(gap, r.top - bottom)
      bottom = Math.max(bottom, r.bottom)
    }
    const glyphs = [...document.querySelectorAll('.player-mat .mat-store .mat-art')].map((s) => s.getBoundingClientRect().height)
    const saving = document.querySelector('.table-cath-line [data-goal-line="saving"]')
    return {
      width: f.getBoundingClientRect().width,
      share: fill.width / track.width,
      now: Number(meter.getAttribute('aria-valuenow')),
      max: Number(meter.getAttribute('aria-valuemax')),
      gap,
      glyphs,
      savingShown: saving ? saving.getBoundingClientRect().width > 2 : false,
    }
  })
  expect(m.width).toBeGreaterThanOrEqual(240)
  expect(m.max).toBeGreaterThan(m.now)
  expect(Math.abs(m.share - m.now / m.max)).toBeLessThan(0.04)
  expect(m.gap).toBeLessThanOrEqual(40)
  expect(m.glyphs.length).toBe(3)
  for (const h of m.glyphs) expect(h).toBeGreaterThanOrEqual(48)
  // Cath's bubble doesn't repeat what the card shows.
  expect(m.savingShown).toBe(false)
})
