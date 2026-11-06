import type { Page } from '@playwright/test'

// Plan item 212: on an upright phone tomorrow's papers fold into a placard; this opens its sheet so a test can
// reach the three memos. A no-op where the strip is always shown (desktop, landscape, tablets).
export async function openPapers(page: Page) {
  const placard = page.locator('[data-intent-placard]')
  if (!(await placard.isVisible())) return
  if ((await placard.getAttribute('aria-expanded')) !== 'true') await placard.click()
  await page.locator('.plan-strip[data-open]').waitFor()
}
