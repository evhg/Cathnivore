import { test, expect, type Page } from '@playwright/test'

// SPEC 11.5: the CSP's `style-src` allows only `'self'` (no `'unsafe-inline'`) — vercel.json was changed
// to drop the exception, since it isn't visible locally (Vercel's headers aren't sent by `vite preview`,
// so a real CSP violation wouldn't show up as a console error in this suite). What *is* checkable here,
// regardless of server headers: a DOM `style="..."` attribute is exactly what that header would block, so
// this guards the CSP by construction instead of only by the header being right.
async function inlineStyleCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('[style]').length)
}

test('the app never renders a DOM element with an inline style attribute', async ({ page }) => {
  await page.goto('/')
  expect(await inlineStyleCount(page)).toBe(0)

  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  expect(await inlineStyleCount(page)).toBe(0)

  // The map's targeting mode and the plan-strip highlight both toggle classes, not styles — exercise both.
  const expandButton = page.locator('.plan-strip button', { hasText: 'Expand' })
  await expandButton.click()
  expect(await inlineStyleCount(page)).toBe(0)
})

test('the /privacy and /support pages have no inline style attribute either', async ({ page }) => {
  // Trailing slash: `vercel.json`'s rewrite (`/privacy` -> `/privacy/index.html`) is what makes the
  // extension-less production URL work; the local preview server has no such rewrite and would otherwise
  // fall through to the SPA's own `index.html` instead of these static pages.
  await page.goto('/privacy/')
  await expect(page).toHaveTitle(/Privacy/)
  expect(await inlineStyleCount(page)).toBe(0)
  await page.goto('/support/')
  await expect(page).toHaveTitle(/Support/)
  expect(await inlineStyleCount(page)).toBe(0)
})
