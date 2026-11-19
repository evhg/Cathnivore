import type { Page } from '@playwright/test'

/** Plan item 54: on a phone the Setup seed folds behind an "Advanced" chip; open it first, then type the seed. */
export async function fillSeed(page: Page, seed: string): Promise<void> {
  // Setup loads on demand (its own chunk), so wait for it to mount before asking whether "Advanced" shows.
  await page.locator('input[inputmode="numeric"]').waitFor({ state: 'attached' })
  const advanced = page.getByRole('button', { name: 'Advanced' })
  if ((await advanced.isVisible()) && (await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click()
  await page.locator('input[inputmode="numeric"]').fill(seed)
}

// A hand card clicked the moment it settles: on a phone the hand row smooth-scrolls to Cath's card after each move,
// and a forced click during that scroll lands on whichever card is passing (plan item 519's notes, 2026-11-19).
export async function clickSettled(button: import('@playwright/test').Locator) {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const b = await button.boundingBox()
    const now = b ? `${Math.round(b.x)},${Math.round(b.y)}` : ''
    if (now && now === last) break
    last = now
    await button.page().waitForTimeout(60)
  }
  await button.click({ force: true })
}
