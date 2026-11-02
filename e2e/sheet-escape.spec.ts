import { test, expect } from '@playwright/test'

// Plan item 33: on a phone, Escape closes the Farm, Market, Cath's Plan and Log sheets, and focus goes back to
// the rail tab that opened them.
test('Escape closes each phone sheet and returns focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the sheets are the phone layout; a desktop shows inline panels')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  for (const name of ['Farm', 'Market', 'Cath’s Plan', 'Log']) {
    const tab = page.locator('.rail-tab', { hasText: name === 'Cath’s Plan' ? 'Plan' : name }).first()
    await tab.focus()
    await tab.press('Enter')
    const sheet = page.getByRole('dialog', { name })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(tab).toBeFocused()
  }
})
