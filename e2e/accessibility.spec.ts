import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// SPEC 11.4 gate 6: "axe finds no serious or critical issues on the title, setup, game and scene screens."
async function assertNoSeriousIssues(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

test('title screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
  await assertNoSeriousIssues(page)
})

test('setup screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  await assertNoSeriousIssues(page)
})

test('game screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  await assertNoSeriousIssues(page)
})

test('scene screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Campaign').click()
  await page.getByRole('button', { name: /Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await assertNoSeriousIssues(page)
})
