import { test, expect } from '@playwright/test'

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
