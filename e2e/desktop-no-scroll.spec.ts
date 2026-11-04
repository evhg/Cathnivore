import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// SPEC 10.3: "Three columns: both producers' farms on the left, the map and enemy plan strip in the
// centre, and the Market, Cath's Plan and Log on the right. No scrolling at 1280×800." Prior sessions only
// verified this by screenshot (DECISIONS.md gate-8 entries), which can't catch actual overflow/scroll
// behaviour — a screenshot looks identical whether or not the element it captures is scrollable. This test
// checks it for real, at the literal viewport size, using chapter 5's pre-built mid-game position (2
// producers, several liberated regions, tableau items and log entries already present) as the most
// content-dense realistic state rather than a fresh, mostly-empty game.
//
// History (see DECISIONS.md for the full account): several sessions closed this gap step by step — a
// 3-column `.actions` grid, a shrunk desktop-only map, denser card-list spacing, a tighter topbar and
// smaller sheet-panel headings — without fully closing it. The two pieces that finally did: (1) the
// Market/Cath's Plan card lists collapse to name/cost by default via a native <details> on desktop
// (MarketSheet.tsx/CathsPlanSheet.tsx), since a full game's rules-text-plus-flavour text for every card no
// longer has to fit unexpanded; (2) `.actions` gets the same internally-scrolling max-height the Log
// already had, since its length genuinely varies with the legal-action count (one entry per region/card/
// quantity target) the same way the Log's turn history does — no fixed-height column can guarantee zero
// overflow against a moving target, so the honest fix is a bounded, keyboard-reachable scroll region, not
// another one-off CSS squeeze. Confirmed with repeated runs (game-state variance affects action count):
// `.game`/`.desktop-col-left`/`.desktop-col-right` all measure 0px of overflow every time now.
test('desktop game screen has no scrolling at 1280x800, even in a content-dense mid-game position', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'desktop layout only kicks in at the 1024px breakpoint; one Chromium check is enough, same pattern as e2e/ai-teammate.spec.ts')

  await page.setViewportSize({ width: 1280, height: 800 })

  await page.goto('/')
  await page.getByText('Campaign').click()
  await page.getByRole('button', { name: /^Friends in Low Places/ }).click()
  const soloButton = page.getByRole('button', { name: /^Solo/ })
  if (await soloButton.isVisible().catch(() => false)) await soloButton.click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('.game').waitFor()

  // The page itself must never need to scroll (SPEC's literal "no scrolling").
  const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight)
  expect(pageScrolls).toBe(false)

  // The `.game-layout` grid is pinned to 100vh; `.desktop-col`/`.game`/`.actions`/`.log-sheet` each carry
  // their own internal `overflow-y: auto` as a bounded escape valve for genuinely variable-length content
  // (the Log and the action list), but none of the three top-level columns should ever need to scroll
  // themselves — that's the literal "no scrolling at 1280x800" this test checks.
  const overflowingColumns = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.desktop-col, .game')).filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.className),
  )
  expect(overflowingColumns).toEqual([])
})

// Plan item 33: at 1440x900 on round 1 the Sell and Invest cards show whole in the Actions frame (the
// Farm's name-only row for the active producer pushed the Invest cards half under its foot). Plan item 83: every
// action the turn can play shows whole; what it can't afford yet follows under "Not yet" and may sit below the fold.
test('desktop Actions frame shows every playable card whole on round 1', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.waitForTimeout(400)
  const cut = await page.evaluate(() => {
    const frame = document.querySelector('.actions-sheet .actions')!.getBoundingClientRect()
    const out: string[] = []
    for (const item of document.querySelectorAll('.actions-sheet .action-item')) {
      const label = item.textContent ?? ''
      if (item.querySelector(':scope > button:disabled')) continue
      const r = item.getBoundingClientRect()
      if (r.top < frame.top - 1 || r.bottom > frame.bottom + 1) out.push(label)
    }
    return out
  })
  expect(cut).toEqual([])
})

// Plan item 83: a late, big turn (round 7) at 1440x900. Supply's removals and Rebut's counts are one card each
// with their options as keys; when the playable cards overflow, the Farm block folds (its key beside Undo) and
// the Play cards stand two to a row, so a turn of up to 14 playable cards shows whole.
test('a big round-7 turn shows every playable card whole at 1440x900', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout')
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  for (let deal = 0; deal < 3; deal++) {
    await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=7')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect
      .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(7)
    if (!(await page.locator('.end-screen').isVisible())) break
  }
  await expect(page.locator('.actions-sheet .action-item').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const frame = document.querySelector('.actions-sheet .actions')!.getBoundingClientRect()
    const enabled = [...document.querySelectorAll('.actions-sheet .action-item')].filter((i) => !i.querySelector(':scope > button:disabled'))
    const cut = enabled.filter((i) => {
      const b = i.getBoundingClientRect()
      return b.top < frame.top - 1 || b.bottom > frame.bottom + 1
    })
    const supplyCards = enabled.filter((i) => /^Supply/.test(i.textContent ?? '') || i.getAttribute('data-family') === 'supply').length
    const supplyKeys = document.querySelectorAll('.actions-sheet .action-family[data-family="supply"] button').length
    return {
      enabled: enabled.length,
      cut: cut.map((i) => i.textContent),
      supplyCards,
      supplyKeys,
      folded: document.querySelector('.desktop-col-left')!.hasAttribute('data-big-turn'),
      farmInline: !!document.querySelector('.desktop-col-left .farm-inline'),
      farmKey: (document.querySelector<HTMLElement>('.actions-sheet .controls .rail-tab-farm')?.offsetWidth ?? 0) > 0,
    }
  })
  testInfo.annotations.push({ type: 'turn', description: JSON.stringify(r) })
  if (process.env.SHOW_TURN) console.log('TURN', r.enabled, r.folded, r.cut.length)
  // Supply never takes more than one card; a family card carries its options as keys.
  expect(r.supplyCards).toBeLessThanOrEqual(1)
  if (r.supplyKeys > 0) expect(r.supplyKeys).toBeGreaterThanOrEqual(2)
  // The Farm folds only on a big turn, and its key stands in for it.
  expect(r.farmInline).toBe(!r.folded)
  expect(r.farmKey).toBe(r.folded)
  if (r.enabled <= 14) expect(r.cut, JSON.stringify(r)).toEqual([])
})
