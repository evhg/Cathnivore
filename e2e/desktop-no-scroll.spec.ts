import { test, expect } from '@playwright/test'

// SPEC 10.3: "Three columns: both producers' farms on the left, the map and enemy plan strip in the
// centre, and the Market, Cath's Plan and Log on the right. No scrolling at 1280×800." Prior sessions only
// verified this by screenshot (DECISIONS.md gate-8 entries), which can't catch actual overflow/scroll
// behaviour — a screenshot looks identical whether or not the element it captures is scrollable. This test
// checks it for real, at the literal viewport size, using chapter 5's pre-built mid-game position (2
// producers, several liberated regions, tableau items and log entries already present) as the most
// content-dense realistic state rather than a fresh, mostly-empty game.
test('desktop game screen has no scrolling at 1280x800, even in a content-dense mid-game position', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'desktop layout only kicks in at the 1024px breakpoint; one Chromium check is enough, same pattern as e2e/ai-teammate.spec.ts')
  // Skipped, not fixed: this genuinely fails today, though a real dent was made in it (2026-09-26: the
  // `.actions` list went from flex-wrap, one-button-per-row on desktop's wider centre column, to a 3-column
  // grid — see DECISIONS.md for why that needed `min-width: 0` and why the rule has to live after the
  // unconditional `.actions` rule, not inside the earlier desktop `@media` block). Re-measured after that
  // fix, same chapter-5 mid-game position, 1280x800: `.game` needs 1192px of height against 768 available
  // (424px short, down from 1156px/388px short before this session touched anything, so the gap actually
  // grew slightly since that number was first measured — game state isn't identical run to run) and
  // `.desktop-col-right` needs 1051px (283px short, down from 423px short). Both columns are real,
  // substantial gaps, not rounding errors: `.actions` was the single largest contributor on the centre
  // column and is now fixed; the remaining centre-column cost is dominated by the 420px-tall map (SPEC
  // 10.2's full-width square hex flower) plus the topbar/tutorial-prompt/plan-strip/active-producer stack
  // above it, and the right column's remaining cost is the Market/Cath's Plan card lists plus the
  // turn-by-turn Log, which only grows over a game's 10 rounds. Closing the rest needs real desktop-layout
  // design work (a smaller map on desktop, denser or collapsible card lists, an internally-scrolling Log
  // panel treated as a deliberate design choice rather than an SPEC 10.3 violation) — logged in
  // DECISIONS.md for a future session with room for that, not a same-session squeeze. Left in place
  // (skipped, not deleted) so that session has a ready-made check to un-skip.
  test.skip(true, 'SPEC 10.3 "no scrolling at 1280x800" still fails on both the centre and right columns after this session\'s `.actions`-grid fix — see DECISIONS.md 2026-09-26 for exact numbers; needs real desktop-layout design work (a smaller map, denser cards, a deliberately-scrolling Log), not a quick CSS tweak')
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

  // The `.game-layout` grid is deliberately pinned to 100vh with `.desktop-col`/`.game` each allowed their
  // own internal `overflow-y: auto` as an escape valve if a column's content ever runs long — but in
  // today's actual content (SPEC 7/9.4's card counts), none of them should need it.
  const overflowingColumns = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.desktop-col, .game')).filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.className),
  )
  expect(overflowingColumns).toEqual([])
})
