import { test, expect } from '@playwright/test'

// Plan item 141: on Normal Cath marks one card, the move she'd play, and says why; Settings turns it off.
test('Cath suggests exactly one move in round 1, and the Settings toggle hides it', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  await expect(page.locator('.actions [data-suggested]')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('.actions [data-suggested] .suggest-leaf')).toHaveCount(1)
  await expect(page.getByTestId('suggest-line')).toContainText('Cath:')
  // Turn it off the way Settings stores it, then reload the saved game.
  await page.evaluate(() => {
    const key = 'cathnivore:settings:v1'
    const raw = localStorage.getItem(key)
    const s = raw ? JSON.parse(raw) : { version: 1 }
    localStorage.setItem(key, JSON.stringify({ ...s, version: 1, suggestions: false }))
  })
  await page.reload()
  const resume = page.getByRole('button', { name: /Continue|Resume/ })
  if (await resume.first().isVisible().catch(() => false)) await resume.first().click()
  await expect(page.locator('.game')).toBeVisible()
  await expect(page.locator('.actions .action-item').first()).toBeVisible()
  await expect(page.locator('.actions [data-suggested]')).toHaveCount(0)
  await expect(page.getByTestId('suggest-line')).toHaveCount(0)
})
