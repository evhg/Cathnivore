import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// SPEC 11.4 gate 6: "axe finds no serious or critical issues on the title, setup, game and scene screens."
async function assertNoSeriousIssues(page: import('@playwright/test').Page) {
  // Judge the screen at rest: an entrance fade (the title's Cath and her line rise in over 1.4 s) measured
  // mid-way reads as low contrast. Looping animations are left running.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 })
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

// `--soil` (headings on paper, `.scene-speaker` names) had no dark-mode override at all until a 2026-09-28
// QA pass caught it (2.17:1 on the dark paper background) — undetected until then because no dark-theme
// scene test existed, even though the light-mode scene test above did. This is that missing test.
test('scene screen has no serious or critical accessibility issues in forced dark theme', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings').click()
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Campaign').click()
  await page.getByRole('button', { name: /Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await assertNoSeriousIssues(page)
})

// The guided tutorial (chapter 1): Cath's card and the spotlight on an explain step and an action step,
// and the campaign screen with its first-time "Start here" key.
test('guided tutorial and campaign screens have no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.getByRole('heading', { name: 'Campaign' })).toBeVisible()
  await assertNoSeriousIssues(page)
  await page.getByRole('button', { name: /Fresh Meat/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.coach')).toBeVisible()
  await assertNoSeriousIssues(page)
  for (let i = 0; i < 6; i++) await page.locator('.coach-primary').click()
  await expect(page.locator('.coach')).toHaveAttribute('data-for', 'action')
  await assertNoSeriousIssues(page)
})
