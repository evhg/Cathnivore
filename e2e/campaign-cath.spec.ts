import { expect, test } from '@playwright/test'

// Plan item 113 (slice 1): Cath presents the chapters on the Campaign screen: half-length, 160 px tall at D and
// 110 on a phone, with a speech bubble at 15 px or more whose line follows the chapter under the pointer or focus.
test('Cath speaks about the chapter under the pointer or focus', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  const fig = page.locator('.cmp-cath')
  await expect(fig).toBeVisible()
  const phone = page.viewportSize()!.width <= 600
  const art = (await page.locator('.cmp-header-cath').boundingBox())!
  expect(art.height).toBeGreaterThanOrEqual(phone ? 110 : 160)
  const size = await page.locator('.cmp-cath-line').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  expect(size).toBeGreaterThanOrEqual(15)
  // The next chapter to play by default; another chapter's line when it takes focus.
  await expect(fig).toHaveAttribute('data-chapter', 'word-of-mouth')
  const before = await page.locator('.cmp-cath-line').textContent()
  await page.locator('.cmp-card').nth(2).focus()
  await expect(fig).toHaveAttribute('data-chapter', 'growing-season')
  await expect(page.locator('.cmp-cath-line')).not.toHaveText(before!)
})
