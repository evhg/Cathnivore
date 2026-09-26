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

test('settings screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await assertNoSeriousIssues(page)
})

test('credits screen has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Credits').click()
  await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
  await assertNoSeriousIssues(page)
})

// STYLE.md 3.5/3.6: the dark theme has its own colour tokens, so it needs its own contrast check — a
// screen that's fine in the light palette isn't guaranteed fine in the dark one. Forced via Settings'
// theme override (added alongside this test) rather than `page.emulateMedia`, so this exercises the same
// path a real player forcing dark mode would use.
test('game screen has no serious or critical accessibility issues in forced dark theme', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings').click()
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  await assertNoSeriousIssues(page)
})

// The "Recommended" badge (SPEC 6) originally used a fixed-in-both-themes fill (`--pasture-deep`) with an
// adaptive text colour (`--paper`), which cleared 4.5:1 in light mode but dropped to 2.76:1 once `--paper`
// went dark — this test is what would have caught it, run in the theme that actually broke.
test('setup screen has no serious or critical accessibility issues in forced dark theme', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings').click()
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  await assertNoSeriousIssues(page)
})
