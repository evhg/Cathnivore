import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "chapters 2-6 each load, play at least one round, and reach their end screen using a
// test-only auto-play hook." `?e2eAutoplay=1` (src/ui/Game.tsx) already covers this for any Game screen,
// campaign chapters included, so the same hook drives chapters 1-2 here (the only chapters built so far —
// see PROGRESS.md's M5 section).
// Chapters 1-2 are tuned to a near-certain HeuristicBot win (see tests/chapters.test.ts); chapter 3 only
// guarantees >=70% (SPEC 9.4's chapters-2-4 floor, not 100%), so this asserts the mechanical flow — opening
// scene, a played-out game, an end screen, and Continue going somewhere sensible — rather than a win every
// time, to avoid a flaky gate on the ~30% of seeds where even HeuristicBot loses chapter 3.
for (const title of ['Fresh Meat', 'Word of Mouth', 'Growing Season']) {
  test(`campaign chapter "${title}" plays through its opening scene and reaches its end screen`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))

    await page.goto('/?e2eAutoplay=1')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await page.getByRole('button', { name: new RegExp(title) }).click()

    await expect(page.locator('.scene')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
    const won = (await page.locator('.end-screen').textContent())?.includes('You liberated Marrow.') ?? false
    await page.getByRole('button', { name: 'Continue' }).click()

    // A win continues into the closing scene; a loss goes back to the chapter list.
    if (won) {
      await expect(page.locator('.scene')).toBeVisible()
    } else {
      await expect(page.locator('.campaign')).toBeVisible()
    }

    expect(errors).toEqual([])
  })
}
