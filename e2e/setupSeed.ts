import type { Page } from '@playwright/test'

/** Plan item 54: on a phone the Setup seed folds behind an "Advanced" chip; open it first, then type the seed. */
export async function fillSeed(page: Page, seed: string): Promise<void> {
  // Setup loads on demand (its own chunk), so wait for it to mount before asking whether "Advanced" shows.
  await page.locator('input[inputmode="numeric"]').waitFor({ state: 'attached' })
  const advanced = page.getByRole('button', { name: 'Advanced' })
  if ((await advanced.isVisible()) && (await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click()
  await page.locator('input[inputmode="numeric"]').fill(seed)
}
