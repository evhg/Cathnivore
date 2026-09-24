import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "Hot-seat: two full turns, undo works, and reloading mid-turn resumes an identical
// state." `?e2eAutoplay=1` isn't used here — Hot-seat has no AI producer, so this test drives the clicks
// itself (Graft is always a legal action, SPEC 4.6.7, so it's a reliable way to spend an action without
// depending on region-targeting).
test('Hot-seat: two full turns, undo, and reload mid-turn resume an identical state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByLabel('Hot-seat (two humans)').check()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()

  async function graft() {
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }

  // Undo: take one action, confirm it changed state, undo it, confirm it's back.
  const initial = await page.locator('.active-producer').innerText()
  await graft()
  const afterGraft = await page.locator('.active-producer').innerText()
  expect(afterGraft).not.toBe(initial)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => page.locator('.active-producer').innerText()).toBe(initial)

  // First producer's full turn (3 actions, SPEC 4.5.2) hands the turn to the second producer.
  const firstName = (await page.locator('.active-producer strong').innerText()).trim()
  await graft()
  await graft()
  await graft()
  await expect(page.locator('.active-producer strong')).not.toHaveText(firstName)

  // Partway into the second producer's turn — not all 3 actions, so the round (and its enemy turn) hasn't
  // ended yet — reload and confirm the resumed state matches exactly.
  await graft()
  await graft()
  const midTurnState = await page.locator('.active-producer').innerText()

  await page.reload()
  await page.getByText('Continue').click()
  await expect.poll(() => page.locator('.active-producer').innerText()).toBe(midTurnState)

  expect(errors).toEqual([])
})
