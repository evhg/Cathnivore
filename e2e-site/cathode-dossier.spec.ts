import { expect, test } from '@playwright/test'

// Plan item 210: on an upright phone the class sheet is a paper dossier: four stat dials, text 12 px or more, the
// card clear of the class tabs, and the file on one screen.
type Front = { cathodeFront?: { ready?: boolean } }

test('the phone class sheet is a dossier with four dials', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 700, 'the upright phone')
  test.setTimeout(300_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const card = page.locator('.cp-sheet[data-dossier]')
  await expect(card).toBeVisible()
  await expect(card.locator('.stat-dial')).toHaveCount(4)
  const m = await page.evaluate(() => {
    const c = document.querySelector('.cp-sheet')!.getBoundingClientRect()
    const tabs = [...document.querySelectorAll('[role="tab"], .cp-class')].map((t) => t.getBoundingClientRect()).filter((r) => r.width)
    const small = [...document.querySelectorAll('.cp-sheet *')].filter((e) => e.childElementCount === 0 && e.textContent!.trim() && (e as HTMLElement).offsetWidth && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => e.textContent!.trim())
    return { bottom: c.bottom, meetsTabs: tabs.some((t) => t.top < c.bottom && c.top < t.bottom && t.left < c.right && c.left < t.right), small, scroll: document.scrollingElement!.scrollHeight - innerHeight }
  })
  expect(m.small).toEqual([])
  expect(m.meetsTabs).toBe(false)
  expect(m.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  expect(m.scroll).toBeLessThanOrEqual(1)
})
