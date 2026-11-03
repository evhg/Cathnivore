import { test, expect } from '@playwright/test'

// Plan item 56: How to Play as Cath's almanac, a chapter per tabbed page.
async function openAlmanac(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('How to Play').click()
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible()
}

test('opens on Start here with the quick tour, and every chapter has a page with Cath\'s note', async ({ page }) => {
  await openAlmanac(page)
  await expect(page.getByRole('tab', { name: 'Start here' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Quick tour' })).toBeVisible()
  for (const name of ['Your round', 'Selling', 'Investing', 'Hollowell', 'Winning', 'Producers', 'Cards']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('tabpanel').getByRole('complementary', { name: "Cath's note" })).toBeVisible()
    await expect(page.getByRole('tabpanel').locator('figure')).toBeVisible()
  }
  // The galleries are real cards, not text rows.
  await expect(page.getByRole('list', { name: "Every Scheme in Cath's Plan" }).locator('.card-vignette').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Producers' }).click()
  await expect(page.getByRole('list', { name: 'The producers' }).getByRole('listitem')).toHaveCount(4)
})

test('a search for Squeeze lands on Hollowell with Squeeze highlighted, and nothing else on the page', async ({ page }) => {
  await openAlmanac(page)
  await page.getByRole('searchbox', { name: 'Search the rules reference' }).fill('Squeeze')
  await expect(page.getByRole('tab', { name: 'Hollowell' })).toHaveAttribute('aria-selected', 'true')
  const hits = page.getByRole('tabpanel').locator('[data-hit]')
  await expect(hits).toHaveCount(1)
  await expect(hits.locator('dt')).toHaveText('Squeeze')
  await expect(hits).toBeInViewport()
  await page.getByRole('searchbox').fill('zzzzqx')
  await expect(page.getByText('No matches for "zzzzqx".')).toBeVisible()
})

test('keyboard only: arrow keys walk the tabs and the page follows', async ({ page }) => {
  await openAlmanac(page)
  await page.getByRole('tab', { name: 'Start here' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Your round' })).toBeFocused()
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Your round' })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Cards' })).toBeFocused()
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Cards', exact: true })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Start here' })).toBeFocused()
})

test('no sideways scroll on any page', async ({ page }) => {
  await openAlmanac(page)
  for (const name of ['Start here', 'Investing', 'Hollowell', 'Winning', 'Cards']) {
    await page.getByRole('tab', { name }).click()
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, name).toBeLessThanOrEqual(0)
  }
})
