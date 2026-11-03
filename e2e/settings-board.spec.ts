import { test, expect } from '@playwright/test'

// Plan item 56: Settings as Cath's noticeboard. Every control still toggles and persists across a reload,
// and the whole board works from the keyboard.
async function openSettings(page: import('@playwright/test').Page) {
  await page.getByText('Settings', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

test('every Settings control toggles and persists', async ({ page }) => {
  await page.goto('/')
  await openSettings(page)
  const switches = ['Animations', 'Colour-blind patterns', 'Sound on']
  const before: Record<string, boolean> = {}
  for (const name of switches) {
    const box = page.getByRole('checkbox', { name, exact: true })
    before[name] = await box.isChecked()
    await box.setChecked(!before[name])
  }
  // Effects and ambience need the sound on.
  if (!(await page.getByRole('checkbox', { name: 'Sound on' }).isChecked())) await page.getByRole('checkbox', { name: 'Sound on' }).check()
  const effects = page.getByRole('checkbox', { name: /^Effects/ })
  const effectsBefore = await effects.isChecked()
  await effects.setChecked(!effectsBefore)
  await page.getByRole('slider', { name: 'Volume' }).fill('35')
  await page.getByRole('radio', { name: 'Dark' }).check()
  await page.getByRole('radio', { name: 'fast' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await openSettings(page)
  await expect(page.getByRole('checkbox', { name: 'Animations' })).toBeChecked({ checked: !before.Animations })
  await expect(page.getByRole('checkbox', { name: 'Colour-blind patterns' })).toBeChecked({ checked: !before['Colour-blind patterns'] })
  await expect(page.getByRole('checkbox', { name: /^Effects/ })).toBeChecked({ checked: !effectsBefore })
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('35')
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'fast' })).toBeChecked()
})

test('Settings by keyboard alone: tab to the theme, pick Light with the arrows, and leave by Back', async ({ page }) => {
  await page.goto('/')
  await openSettings(page)
  const auto = page.getByRole('radio', { name: 'Auto' })
  for (let i = 0; i < 20 && !(await auto.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(auto).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const back = page.getByRole('button', { name: 'Back' })
  for (let i = 0; i < 20 && !(await back.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(back).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
})

test('the theme previews show the table, and the board has no sideways scroll', async ({ page }) => {
  await page.goto('/')
  await openSettings(page)
  await expect(page.locator('.theme-preview')).toHaveCount(3)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over).toBeLessThanOrEqual(0)
})
