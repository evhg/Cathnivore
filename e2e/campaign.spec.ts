import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "chapters 2-6 each load, play at least one round, and reach their end screen using a
// test-only auto-play hook." `?e2eAutoplay=1` (src/ui/Game.tsx) already covers this for any Game screen,
// campaign chapters included, so the same hook drives chapters 1-2 here (the only chapters built so far —
// see PROGRESS.md's M5 section).
for (const title of ['Fresh Meat', 'Word of Mouth']) {
  test(`campaign chapter "${title}" plays through its opening scene, wins, and shows its closing scene`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))

    await page.goto('/?e2eAutoplay=1')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await page.getByRole('button', { name: new RegExp(title) }).click()

    await expect(page.locator('.scene')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('You liberated Marrow.')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.locator('.scene')).toBeVisible()

    expect(errors).toEqual([])
  })
}
