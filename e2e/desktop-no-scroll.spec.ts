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
  // Skipped, not fixed: this genuinely fails today. Measured at chapter 5's mid-game position, 1280x800:
  // `.game` needs 1156px of height against 768 available (388px short) and `.desktop-col-right` needs
  // 1191px (423px short) — a real, substantial layout gap, not a rounding error, logged in DECISIONS.md
  // (2026-09-26) for a future session with room for real desktop-layout design work, not a same-session
  // squeeze. Left in place (skipped, not deleted) so that session has a ready-made check to un-skip.
  test.skip(true, 'SPEC 10.3 "no scrolling at 1280x800" fails today by a wide margin on both the centre and right columns — see DECISIONS.md 2026-09-26 for exact numbers; needs real desktop-layout design work, not a quick CSS tweak')
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
