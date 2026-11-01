import { test, expect, type Page } from '@playwright/test'

// Plan item 11: the enemy turn is played in the boardroom strip, with both HQs on the map and each step's
// pieces flying out of them. A tap still skips the whole turn (SPEC 10.2), and reduced motion only fades.

async function playToEnemyTurn(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByLabel('Hot-seat (two humans)').check()
  await page.getByRole('button', { name: 'Start' }).click()
  const graft = () => page.getByRole('button', { name: /^Graft:/ }).click({ force: true })
  for (let i = 0; i < 3; i++) await graft()
  await page.getByRole('button', { name: "I'm ready" }).click()
  for (let i = 0; i < 3; i++) await graft()
  await expect(page.locator('.enemy-turn-playback.boardroom')).toBeVisible()
}

test('the boardroom strip shows a face and the HQs, flies a piece, and a tap skips the turn', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await playToEnemyTurn(page)

  await expect(page.locator('.enemy-turn-layer [data-hq="hollowell"]')).toBeAttached()
  await expect(page.locator('.enemy-turn-layer [data-hq="candor"]')).toBeAttached()
  // Round 1's pressure always places pieces (Expand or Scout), so some step flies one.
  await expect(page.locator('.enemy-turn-layer .flight[data-flight]').first()).toBeAttached({ timeout: 8_000 })
  await expect(page.locator('.boardroom-face svg')).toBeVisible()

  await page.locator('.enemy-turn-playback').click()
  await expect(page.locator('.enemy-turn-playback')).toHaveCount(0)
  await expect(page.locator('.enemy-turn-layer')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Graft:/ })).toBeEnabled()
  expect(errors).toEqual([])
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('pieces fade in on their hex instead of flying', async ({ page }) => {
    await playToEnemyTurn(page)
    const piece = page.locator('.enemy-turn-layer .flight-piece').first()
    await expect(piece).toBeAttached({ timeout: 8_000 })
    expect(await piece.evaluate((el) => getComputedStyle(el).animationName)).toBe('flight-fade')
    expect(await page.locator('.boardroom-row, .boardroom-cath').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('boardroom-fade')
  })
})
