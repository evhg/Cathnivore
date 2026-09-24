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
