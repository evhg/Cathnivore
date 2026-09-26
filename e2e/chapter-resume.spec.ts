import { test, expect } from '@playwright/test'

// SPEC 8.1/11.3: "saves survive a reload" and campaign "save and resume" are both "never cut" (SPEC 1.5).
// Reloading mid-chapter used to lose the chapter's identity entirely — `platform/storage.ts`'s `SavedGame`
// only carried {config, seed, actions}, so `App.tsx`'s `resume()` always rebuilt a plain Quick Game screen
// with no `onChapterEnd` handler. The game itself kept playing correctly (config/seed/actions replay fine),
// but finishing it could never call `markChapterComplete` again — a reload mid-chapter silently and
// permanently stalled that chapter's campaign progress. Fixed by carrying `chapterId` in the save and
// having `resume()` reconstruct the `chapterGame` screen when it's present.
test('reloading mid-chapter resumes into the campaign chapter, not a plain Quick Game', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/?e2eAutoplay=1')
  await page.getByRole('button', { name: 'Campaign' }).click()
  // Chapter 1 ("Fresh Meat") is single-producer, so it skips the Solo/Hot-seat choice.
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.locator('.game')).toBeVisible()

  // Reload mid-game, before the chapter's end screen — this is the exact moment the old code lost the
  // chapter's identity. The title screen (not an auto-resume) is what a real reload lands on; Continue is
  // the same path a player uses.
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Still in a real game screen (not dumped back to the title screen), and autoplay carries it through to
  // the end. If `resume()` had rebuilt a plain Quick Game screen, this would still show an end screen (the
  // engine doesn't care), but `onChapterEnd` would never fire and the chapter would never be marked
  // complete below.
  await expect(page.locator('.game, .end-screen')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
  const won = (await page.locator('.end-screen').textContent())?.includes('You liberated Marrow.') ?? false
  await page.getByRole('button', { name: 'Continue' }).click()

  if (won) {
    // A win goes to the closing scene, then back to the campaign list marked complete — only reachable via
    // `endChapter`, which only a resumed `chapterGame` screen (not a plain Quick Game) ever calls.
    await expect(page.locator('.scene')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('button', { name: /^Fresh Meat.*\(completed\)/ })).toBeVisible()
  } else {
    // A loss reaches SPEC 8.1's retry screen, which only a resumed `chapterGame` (not a plain Quick Game,
    // which has no such screen at all) can ever show.
    await expect(page.locator('.campaign.chapter-loss')).toBeVisible()
  }

  expect(errors).toEqual([])
})
