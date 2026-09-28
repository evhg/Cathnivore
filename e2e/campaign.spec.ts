import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "chapters 2-6 each load, play at least one round, and reach their end screen using a
// test-only auto-play hook." `?e2eAutoplay=1` (src/ui/Game.tsx) already covers this for any Game screen,
// campaign chapters included, so the same hook drives chapters 1-2 here (the only chapters built so far —
// see PROGRESS.md's M5 section).
// Chapters 1-2 are tuned to a near-certain HeuristicBot win (see tests/chapters.test.ts); chapter 3 only
// guarantees >=70% (SPEC 9.4's chapters-2-4 floor, not 100%), so this asserts the mechanical flow — opening
// scene, a played-out game, an end screen, and Continue going somewhere sensible — rather than a win every
// time, to avoid a flaky gate on the ~30% of seeds where even HeuristicBot loses chapter 3.
for (const title of ['Fresh Meat', 'Word of Mouth', 'Growing Season', 'The Plan', 'Friends in Low Places', 'Kingsmarket']) {
  test(`campaign chapter "${title}" plays through its opening scene and reaches its end screen`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))

    await page.goto('/?e2eAutoplay=1')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click()

    // 2-producer chapters (SPEC 8.1) show a Solo/Hot-seat choice before the opening scene.
    const soloButton = page.getByRole('button', { name: /^Solo/ })
    if (await soloButton.isVisible().catch(() => false)) {
      await soloButton.click()
    }

    await expect(page.locator('.scene')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
    const won = (await page.locator('.end-screen').textContent())?.includes('You liberated Marrow.') ?? false
    await page.getByRole('button', { name: 'Continue' }).click()

    // A win continues into the closing scene; a loss goes to the SPEC 8.1 retry screen (Retry/Play on
    // Easy/Skip Chapter), which reuses the `.campaign` class alongside its own `.chapter-loss` one.
    if (won) {
      await expect(page.locator('.scene')).toBeVisible()
    } else {
      await expect(page.locator('.campaign.chapter-loss')).toBeVisible()
    }

    expect(errors).toEqual([])
  })
}

// SPEC 8.1/11.3: regression coverage for a real, narrow bug a review session found — dismissing a mid-game
// scripted scene (chapter 3's round-5 "twist" here) is a UI-only event with no engine action, so nothing in
// the save's replayed log recorded it; a reload right after dismissing but before any further action used
// to replay the scene once more (`SavedGame.dismissedMidScenes` now persists it directly — see
// DECISIONS.md). No `?e2eAutoplay=1` here: autoplay auto-dismisses the scene the instant it appears
// (Game.tsx), which would skip the exact window this bug lived in.
test('chapter 3 "Growing Season": dismissing the round-5 reveal then reloading before any action does not replay it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Growing Season/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // A Squeeze hitting Tomas's home region (Oakvale) forces a `currentDecision` (SPEC 9.1: "choose which
  // production to lower") before any normal action is available again — resolve it (any choice) so Graft
  // clicks keep working regardless of which region Squeeze happens to hit this seed.
  async function resolvePendingDecisionIfShown() {
    const choose = page.getByRole('button', { name: /^Choose /i }).first()
    if (await choose.isVisible().catch(() => false)) await choose.click()
  }
  async function graft() {
    await resolvePendingDecisionIfShown()
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }
  async function dismissEnemyTurnIfShown() {
    const playback = page.locator('.enemy-turn-playback')
    if (await playback.isVisible().catch(() => false)) await playback.click()
    await resolvePendingDecisionIfShown()
  }

  // Chapter 3 is single-producer (Tomas, SPEC 8.2), so a full round is 3 Graft actions (always legal, SPEC
  // 4.6.7). Its scripted trigger fires at round 5 (`chapterConfig`'s `scriptedTrigger`), so 4 full rounds
  // reach it.
  for (let round = 1; round <= 4; round++) {
    await graft()
    await graft()
    await graft()
    await dismissEnemyTurnIfShown()
  }

  // The round-5 "twist" scene (SPEC 8.2: Wholesome Hollow is owned by Hollowell) should now be showing.
  await expect(page.locator('.scene')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.scene')).not.toBeVisible()

  // Dismissed, but no further action taken yet — reload right here, the exact window the bug lived in.
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()

  // The scene must not replay: the normal game screen (a legal action available) should show directly.
  await expect(page.locator('.scene')).not.toBeVisible()
  await expect(page.getByRole('button', { name: /^Graft:/ })).toBeVisible()

  expect(errors).toEqual([])
})
