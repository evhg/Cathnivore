import { test, expect } from '@playwright/test'

// ROADMAP 9 "clear disabled and why-not states": Sell's missing counts (Produce too low for 2 or 3) get
// a disabled placeholder button with a reason, right where the real button would be, instead of the
// count range quietly shrinking with no explanation. A fresh Quick Game always starts with 3 Produce
// (enough to legally Sell 1-3), so this spends it down first to reach the disabled state. A fresh game
// can also show Invest's own disabled placeholders from the very start (starting Marks are often below
// a market card's cost) — this test scopes its "nothing disabled yet" check to Sell specifically so it
// doesn't depend on the (RNG-drawn) market's starting affordability.
test('Sell shows a disabled, explained placeholder for counts the player can no longer afford', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  // All 3 Sell counts are legal, real buttons at the start — no disabled Sell placeholder yet.
  await expect(page.getByRole('button', { name: /^Sell 3 Produce/ })).toBeEnabled()
  await expect(page.locator('.action-item', { hasText: 'Sell' }).locator('.action-why-not')).toHaveCount(0)

  await page.getByRole('button', { name: /^Sell 3 Produce/ }).click()
  await page.locator('.actions').waitFor()

  // Produce is now 0: all 3 Sell counts render as disabled placeholders, each with its own reason and
  // a cost chip still showing the amount it would take.
  const disabledSell1 = page.getByRole('button', { name: /^Sell 1 Produce/ })
  const disabledSell2 = page.getByRole('button', { name: /^Sell 2 Produce/ })
  const disabledSell3 = page.getByRole('button', { name: /^Sell 3 Produce/ })
  await expect(disabledSell1).toBeDisabled()
  await expect(disabledSell2).toBeDisabled()
  await expect(disabledSell3).toBeDisabled()
  await expect(page.locator('.action-item', { hasText: 'Sell 1 Produce' }).locator('.action-why-not')).toHaveText('Need 1 more Produce')
  await expect(page.locator('.action-item', { hasText: 'Sell 2 Produce' }).locator('.action-why-not')).toHaveText('Need 2 more Produce')
  await expect(page.locator('.action-item', { hasText: 'Sell 3 Produce' }).locator('.action-why-not')).toHaveText('Need 3 more Produce')

  // Still explained by the same "Sell" glossary tooltip a real Sell button offers (SPEC 10.5).
  const disabledTrigger = page.locator('.action-item', { hasText: 'Sell 1 Produce' }).locator('.tooltip-trigger-button')
  await disabledTrigger.dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  // A disabled button is genuinely inert: clicking it (force, since Playwright's normal click refuses a
  // disabled target) must not change game state — the active producer's turn stays exactly where it was.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await disabledSell1.click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')
})

// ROADMAP 9, continued: Invest gets the same per-card treatment — each market slot the active producer
// can't yet afford renders as its own disabled placeholder (never a generic "nothing affordable"), since
// unlike Scheme/Supply/Rebut/Open Stall its legality is a single Marks-vs-cost comparison per card, just
// like Sell's Produce-vs-count. Seed 1 is pinned so the market draw (and the exact "Marks needed") stay
// deterministic: the starting producer's Marks are below every one of this seed's 4 cards' costs, and 2
// Grafts (+1 Marks each) affords the cheapest, Wholesale Account (4, needing 2 more at the start).
test('Invest shows a disabled, explained placeholder for market cards the player can no longer afford', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const investItems = page.locator('.action-item', { hasText: 'Invest' })
  await expect(investItems).toHaveCount(4)
  for (const item of await investItems.all()) {
    await expect(item.getByRole('button', { name: /^Invest/ })).toBeDisabled()
    await expect(item.locator('.action-why-not')).toHaveText(/^Need \d+ more Marks$/)
  }
  await expect(investItems.filter({ hasText: 'Wholesale Account' }).locator('.action-why-not')).toHaveText('Need 2 more Marks')

  // Still explained by the same "Invest" glossary tooltip a real Invest button offers (SPEC 10.5).
  const disabledTrigger = investItems.first().locator('.tooltip-trigger-button')
  await disabledTrigger.dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  // A disabled button is genuinely inert.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await investItems.first().getByRole('button', { name: /^Invest/ }).click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')

  // Grafting twice (+1 Marks each, no other cost) affords Wholesale Account, which swaps from a disabled
  // placeholder to a real, clickable Invest button — the other 3 cards stay disabled (still short).
  await page.getByRole('button', { name: /^Graft/ }).click()
  await page.getByRole('button', { name: /^Graft/ }).click()
  const wholesaleAccount = page.locator('.action-item', { hasText: 'Wholesale Account' })
  await expect(wholesaleAccount.locator('.action-why-not')).toHaveCount(0)
  await expect(wholesaleAccount.getByRole('button', { name: /^Invest/ })).toBeEnabled()
  await expect(page.locator('.action-item', { hasText: 'Invest' }).locator('.action-why-not')).toHaveCount(3)
})

// ROADMAP 9, continued: a `targeting: 'none'` Scheme (never needs a region) gets the same per-card
// treatment as Sell/Invest — its only legality condition is Goodwill vs. cost. Seed 1's Cath's Plan
// starts with "Paper Trail" (1 Goodwill, playable from the start) and "Seasonal Bonus" (3 Goodwill,
// disabled — the starting producer has 1).
test('a targeting:none Scheme shows a disabled, explained placeholder when unaffordable', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const seasonalBonus = page.locator('.action-item', { hasText: 'Seasonal Bonus' })
  await expect(seasonalBonus.getByRole('button', { name: /^Scheme/ })).toBeDisabled()
  await expect(seasonalBonus.locator('.action-why-not')).toHaveText('Need 2 more Goodwill')

  // A "required"-targeting Scheme (e.g. Fence Jumpers, which needs a liberated-adjacent region) never
  // gets a why-not placeholder — its absence could mean "no legal target" just as easily as "too poor".
  await expect(page.locator('.action-item', { hasText: 'Fence Jumpers' })).toHaveCount(0)

  // Still playable: Paper Trail costs only 1 Goodwill, affordable from the start.
  await expect(page.locator('.action-item', { hasText: 'Paper Trail' }).getByRole('button', { name: /^Scheme/ })).toBeEnabled()

  // A disabled button is genuinely inert.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await seasonalBonus.getByRole('button', { name: /^Scheme/ }).click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')
})

// ROADMAP 9, continued: an 'optional'-targeting Scheme (e.g. Leaked Memo, "Rift +2. Remove 1 Doubt
// anywhere") turns out to have the same single-comparison shape as `targeting: 'none'` — `legalSchemeTargets`
// falls back to an untargeted play whenever no region has Doubt to remove, so unlike a 'required' Scheme
// it's never hidden for "no legal target", only for being unaffordable. Seed 3's Cath's Plan starts with
// Leaked Memo (3 Goodwill, the starting producer has 1) and no Doubt anywhere yet.
test('an optional-targeting Scheme shows a disabled, explained placeholder when unaffordable', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('3')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const leakedMemo = page.locator('.action-item', { hasText: 'Leaked Memo' })
  await expect(leakedMemo.getByRole('button', { name: /^Scheme/ })).toBeDisabled()
  await expect(leakedMemo.locator('.action-why-not')).toHaveText('Need 2 more Goodwill')

  // A disabled button is genuinely inert.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await leakedMemo.getByRole('button', { name: /^Scheme/ }).click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')
})

// ROADMAP 9, continued: Open Stall costs a flat 1 Produce and `legalActions` skips its whole per-region
// loop when Produce is 0 — the only case where "no Open Stall action exists" is unambiguously about
// affordability (a real "no legal region" case, e.g. every region already at its Stall cap, stays
// silently absent, since that's genuinely ambiguous from outside). A fresh Quick Game producer starts
// with 3 Produce, so this spends it all first (Sell) to reach the disabled state.
test('Open Stall shows a disabled, explained placeholder when Produce is 0', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  // A fresh producer already has Stalls in their home region, so Open Stall is a real, enabled group
  // button (not a disabled placeholder) as long as Produce is affordable.
  await expect(page.locator('.action-item', { hasText: 'Open Stall' }).locator('.action-why-not')).toHaveCount(0)

  await page.getByRole('button', { name: /^Sell 3 Produce/ }).click()
  await page.locator('.actions').waitFor()

  const openStall = page.locator('.action-item', { hasText: 'Open Stall' })
  await expect(openStall.getByRole('button', { name: /^Open Stall/ })).toBeDisabled()
  await expect(openStall.locator('.action-why-not')).toHaveText('Need 1 more Produce')

  // Still explained by the same "Open Stall" glossary tooltip a real Open Stall button offers.
  await openStall.locator('.tooltip-trigger-button').dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  // A disabled button is genuinely inert.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await openStall.getByRole('button', { name: /^Open Stall/ }).click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')
})

// ROADMAP 9, continued: Supply and Rebut are per-region grouped actions (SPEC 10.2's map-targeting mode),
// but each kind's legality is still just two checks in a fixed order — a structural one (an owned region
// with something to remove: an Outlet, a Buyout, or Doubt) and then a resource comparison. Those two
// reasons are genuinely distinct, so unlike a 'required'/'optional' Scheme's single region check they're
// worth surfacing. SPEC 4.3.2's setup gives every non-capital region exactly 1 starting Outlet and 0
// Buyout, with Doubt only on Coast regions — Mara's home, Brindle Hills, is Pasture — but SPEC 4.3.4 then
// immediately resolves the first Pressure card as an opening Scout, which can add a 2nd Outlet to a
// matching region before the player's first action; seed 1 is pinned so Brindle Hills's opening Scout
// doesn't match Pasture and it stays at exactly its starting 1 Outlet.
test('Rebut and Supply-Buyout show a disabled, explained placeholder when there is nothing to remove yet', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const supplyBuyout = page.locator('.action-item', { hasText: 'Supply: remove Buyout' })
  const rebut1 = page.locator('.action-item', { hasText: 'Rebut: remove 1 Doubt' })
  const rebut2 = page.locator('.action-item', { hasText: 'Rebut: remove 2 Doubt' })

  await expect(supplyBuyout.getByRole('button', { name: /^Supply: remove Buyout/ })).toBeDisabled()
  await expect(supplyBuyout.locator('.action-why-not')).toHaveText('No Buyout to remove')
  await expect(rebut1.getByRole('button', { name: /^Rebut: remove 1 Doubt/ })).toBeDisabled()
  await expect(rebut1.locator('.action-why-not')).toHaveText('No Doubt to rebut')
  await expect(rebut2.getByRole('button', { name: /^Rebut: remove 2 Doubt/ })).toBeDisabled()
  await expect(rebut2.locator('.action-why-not')).toHaveText('No Doubt to rebut')

  // None of these placeholders show a cost chip (SPEC 10.5's tokens) — there's nothing to price when the
  // reason is "nothing to target" rather than "can't afford it".
  await expect(rebut1.locator('.action-cost')).toHaveCount(0)

  // Still explained by the "Rebut" glossary tooltip the real button offers.
  await rebut1.locator('.tooltip-trigger-button').dispatchEvent('click')
  await expect(page.locator('.tooltip-popover')).toBeVisible()

  // A disabled button is genuinely inert.
  const actionsLeftBefore = await page.locator('.active-producer').textContent()
  await rebut1.getByRole('button', { name: /^Rebut: remove 1 Doubt/ }).click({ force: true })
  await expect(page.locator('.active-producer')).toHaveText(actionsLeftBefore ?? '')

  // Supply-remove-1-Outlet starts as a real, legal action (Brindle Hills has its starting Outlet) — using
  // it up removes the only Outlet there, so both Outlet counts flip to disabled "nothing to remove"
  // placeholders right after, the same structural reason as Buyout/Doubt above.
  const realSupply1 = page.getByRole('button', { name: /^Supply: remove 1 Outlet in/ })
  await expect(realSupply1).toBeEnabled()
  await realSupply1.click()
  await page.locator('.actions').waitFor()

  const disabledSupply1 = page.locator('.action-item', { hasText: 'Supply: remove 1 Outlet' })
  const disabledSupply2 = page.locator('.action-item', { hasText: 'Supply: remove 2 Outlets' })
  await expect(disabledSupply1.getByRole('button', { name: /^Supply: remove 1 Outlet/ })).toBeDisabled()
  await expect(disabledSupply1.locator('.action-why-not')).toHaveText('No Outlet left to remove')
  await expect(disabledSupply2.getByRole('button', { name: /^Supply: remove 2 Outlets/ })).toBeDisabled()
  await expect(disabledSupply2.locator('.action-why-not')).toHaveText('No Outlets left to remove')
})

// ROADMAP 9, continued: Open Stall's other legality check (besides Produce) is `canOpenStallIn` — every
// active region either full (SPEC 4.6.1's Stall cap) or unreachable (not the producer's own, nor
// adjacent to one they own). A 2-region game (Mara's home Brindle Hills, Tomas's home Oakvale — SPEC
// 4.3.2's ring puts them next to each other) starts each at cap-1 (2 of 3): Mara can legally Open Stall in
// either (her own, or Oakvale since it borders her Stall), so 2 of her own actions fill both regions to
// cap — with Produce still to spare, the only reason left is the structural one.
test('Open Stall shows a disabled, explained placeholder when every region is full', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'cathnivore:save:v1',
      JSON.stringify({
        version: 1,
        config: { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ['brindleHills', 'oakvale'] },
        seed: 1,
        actions: [],
      }),
    )
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('.game').waitFor()

  const actions = page.locator('.actions')
  await expect(page.locator('.action-item', { hasText: 'Open Stall' }).locator('.action-why-not')).toHaveCount(0)

  await actions.getByRole('button', { name: /^Open Stall/ }).click()
  await page.locator('.region-hex[aria-label="Brindle Hills"]').click()
  await actions.getByRole('button', { name: 'Confirm' }).click()
  await actions.waitFor()

  // Brindle Hills is now full, so Oakvale is the only legal target left — a single, directly-clickable
  // button (SPEC 10.2: a group only needs the map-tap-and-Confirm flow when more than one target remains).
  await actions.getByRole('button', { name: /^Open Stall in Oakvale/ }).click()
  await actions.waitFor()

  const openStall = page.locator('.action-item', { hasText: 'Open Stall' })
  await expect(openStall.getByRole('button', { name: /^Open Stall/ })).toBeDisabled()
  await expect(openStall.locator('.action-why-not')).toHaveText('No region open to place a Stall')
  // Not a cost problem — no chip on a structural placeholder, same as Supply/Rebut above.
  await expect(openStall.locator('.action-cost')).toHaveCount(0)
})
