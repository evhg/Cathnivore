import { expect, test } from '@playwright/test'

// Plan item 659: at a desktop the chosen chapter is a ticket pinned on the atlas beside its numbered stop, with Play
// a short reach from the stop, and pointing at another chapter in the rail moves the ticket to that chapter's stop.
test('desktop campaign: the chapter ticket is pinned beside its stop and follows the rail', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })))
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  await page.mouse.move(4, 896)
  const ticket = page.locator('.cmp-ticket')
  await expect(ticket).toHaveAttribute('data-chapter', 'word-of-mouth')
  const near = async (id: string) =>
    page.evaluate((id) => {
      const pin = document.querySelector(`.cmp-pin[data-chapter="${id}"] .cmp-pin-disc`)!.getBoundingClientRect()
      const t = document.querySelector('.cmp-ticket')!.getBoundingClientRect()
      const play = document.querySelector('.cmp-ticket-play')?.getBoundingClientRect()
      const sheet = document.querySelector('.campaign-screen > .cmp-map .cmp-sheet')!.getBoundingClientRect()
      const px = pin.left + pin.width / 2
      const py = pin.top + pin.height / 2
      const dist = (b: DOMRect) => Math.hypot(Math.max(b.left - px, 0, px - b.right), Math.max(b.top - py, 0, py - b.bottom))
      return { ticket: dist(t), play: play ? dist(play) : null, sheetW: sheet.width, inSheet: t.left >= sheet.left && t.right <= sheet.right }
    }, id)
  const a = await near('word-of-mouth')
  expect(a.play).not.toBeNull()
  expect(a.play!).toBeLessThanOrEqual(200)
  expect(a.inSheet).toBe(true)
  expect(a.sheetW).toBeGreaterThanOrEqual(800)
  // Play on the ticket starts the chapter's own setup
  // pointing at chapter 3 in the rail moves the ticket to stop 3
  await page.locator('.cmp-stop[data-chapter="growing-season"] .cmp-card').hover()
  await expect(ticket).toHaveAttribute('data-chapter', 'growing-season')
  await page.waitForTimeout(400)
  const b = await near('growing-season')
  expect(b.ticket).toBeLessThanOrEqual(120)
  // a locked chapter's ticket has no Play
  await expect(page.locator('.cmp-ticket-play')).toHaveCount(0)
  // the bunting is tied to the map: the ticket's flag is marked, and a flag under the pointer moves the ticket
  await page.mouse.move(4, 896)
  await expect(ticket).toHaveAttribute('data-chapter', 'word-of-mouth')
  await expect(page.locator('.cmp-pennant.is-chosen')).toHaveAttribute('data-chapter', 'word-of-mouth')
  await page.locator('.cmp-pennant').nth(3).hover()
  await expect(ticket).toHaveAttribute('data-chapter', await page.locator('.cmp-pennant').nth(3).getAttribute('data-chapter') as string)
  await expect(page.locator('.cmp-pennant.is-chosen')).toHaveCount(1)
})
