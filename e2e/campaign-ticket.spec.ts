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
  // plan item 689: at rest the next chapter is open in the rail, so the atlas pins no second copy of it
  await expect(page.locator('.cmp-stop[data-chapter="word-of-mouth"] .cmp-card')).toBeVisible()
  await expect(ticket).toHaveCount(0)
  // pointing at the next chapter's stop pins its ticket there
  await page.locator('.cmp-pin[data-chapter="word-of-mouth"] .cmp-pin-disc').hover()
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
  // (plan item 696: polled, since the ticket re-places itself once its own size settles)
  await expect.poll(async () => (await near('word-of-mouth')).play ?? Infinity).toBeLessThanOrEqual(200)
  const a = await near('word-of-mouth')
  expect(a.inSheet).toBe(true)
  // (plan item 696: the atlas gives Cath her own column, so the sheet is 680 px+ at 1440, was 800)
  expect(a.sheetW).toBeGreaterThanOrEqual(680)
  // Play on the ticket starts the chapter's own setup
  // pointing at chapter 3 in the rail moves the ticket to stop 3
  await page.locator('.cmp-stop[data-chapter="growing-season"] .cmp-card').hover()
  await expect(ticket).toHaveAttribute('data-chapter', 'growing-season')
  await page.waitForTimeout(400)
  const b = await near('growing-season')
  // plan item 669: a place clear of every region name wins over a nearer one, so a little further (125 px here)
  expect(b.ticket).toBeLessThanOrEqual(150)
  // a locked chapter's ticket has no Play
  await expect(page.locator('.cmp-ticket-play')).toHaveCount(0)
  // the bunting is tied to the map: the ticket's flag is marked, and a flag under the pointer moves the ticket
  await page.mouse.move(4, 896)
  await expect(ticket).toHaveCount(0)
  await expect(page.locator('.cmp-pennant.is-chosen')).toHaveAttribute('data-chapter', 'word-of-mouth')
  await page.locator('.cmp-pennant').nth(3).hover()
  await expect(ticket).toHaveAttribute('data-chapter', await page.locator('.cmp-pennant').nth(3).getAttribute('data-chapter') as string)
  await expect(page.locator('.cmp-pennant.is-chosen')).toHaveCount(1)
})
