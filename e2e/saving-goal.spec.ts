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
  await expect(shelfCards.first()).toBeVisible()
  const total = await shelfCards.count()
  const shown = () => page.locator('.actions[data-shelf] .action-item[data-later-idx]:visible').count()
  expect(await shown()).toBeLessThanOrEqual(3)
  if (total > 3) await expect(page.locator('.shelf-fold')).toHaveText(`${total - 3} more not yet`)

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
  await expect(page.locator('.action-item[data-later-idx="0"] .saving-jar')).toBeVisible()

  // The fold key opens the rest of the shelf; unpinning clears the goal.
  if (total > 3) {
    await page.locator('.shelf-fold').click()
    expect(await shown()).toBe(total)
  }
  await page.locator('.shelf-pin[aria-pressed="true"]').click()
  await expect(page.locator('.actions[data-shelf]')).not.toHaveAttribute('data-saving-for', /./)
})

test('a goal that becomes affordable lifts into the hand within 800 ms and the pin comes off', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the shelf is the big desktop column')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.shelf-pin').first()).toBeVisible()
  if ((await page.locator('.shelf-fold').count()) > 0) await page.locator('.shelf-fold').click()
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
