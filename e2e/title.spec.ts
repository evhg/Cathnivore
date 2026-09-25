import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "the title screen loads with no console errors."
test('title screen loads with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
  await expect(page.getByText('Quick Game')).toBeVisible()
  await expect(page.getByText('How to Play')).toBeVisible()

  expect(errors).toEqual([])
})

test('How to Play opens and closes the rules reference', async ({ page }) => {
  await page.goto('/')
  await page.getByText('How to Play').click()
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
})

// SPEC 10.1: "Settings: animations, colour-blind patterns, AI speed, and 'Reset all data' with a
// confirmation."
test('Settings toggles persist and Reset all data needs confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const fastSpeed = page.getByRole('radio', { name: 'fast' })
  await fastSpeed.check()
  await expect(fastSpeed).toBeChecked()

  // Reset needs an explicit second confirmation, not a single click.
  await page.getByRole('button', { name: 'Reset all data' }).click()
  await expect(page.getByText(/can.t be undone/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(/can.t be undone/)).not.toBeVisible()

  await page.reload()
  await page.getByText('Settings').click()
  await expect(page.getByRole('radio', { name: 'fast' })).toBeChecked()
})
