import { test, expect } from '@playwright/test'

// Plan item 15: the Daily Market. The title offers today's shared market (map, pair, event); a finished one
// shows its number and streak on the end screen, and the title then marks the day as played.
test('the Daily Market starts today\'s setup and records the result', async ({ page }, testInfo) => {
  const today = new Date().toISOString().slice(0, 10)
  await page.goto('/?e2eAutoplay=1')
  const daily = page.locator('.title-daily')
  await expect(daily).toBeVisible()
  await expect(daily).toHaveAttribute('data-daily', today)
  await expect(daily).toContainText(/Daily Market #\d+/)
  await expect(daily.locator('.title-daily-streak')).toHaveCount(0)
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/daily-title-${testInfo.project.name}.png` })
  await daily.click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.end-daily')).toContainText(/Daily Market #\d+/)
  await page.waitForTimeout(2500)
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/daily-end-${testInfo.project.name}.png` })
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('cathnivore:daily') ?? '{}'))
  expect(rec.results[today]).toBeTruthy()
  await page.getByRole('button', { name: 'Back to Title' }).click()
  await expect(page.locator('.title-daily .title-daily-streak')).toBeVisible()
})
