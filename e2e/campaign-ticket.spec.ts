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

// Plan item 732 (critique 2026-11-27 07:30): at D chapter 1's ticket sat over the atlas's compass rose. Every chapter's
// ticket keeps clear of the compass and the cartouche (10% of either's box at most).
test("desktop campaign: no chapter's ticket covers the compass or the cartouche", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Campaign', { exact: false }).first().click()
    await page.getByRole('heading', { name: 'Campaign' }).waitFor()
    const ids = await page.locator('.cmp-pin[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')!))
    for (const id of ids) {
      await page.locator(`.cmp-pin[data-chapter="${id}"] .cmp-pin-disc`).hover()
      await expect(page.locator('.cmp-ticket')).toHaveAttribute('data-chapter', id)
      await page.waitForTimeout(500)
      const hit = await page.evaluate(() => {
        const t = document.querySelector('.cmp-ticket')!.getBoundingClientRect()
        // the share of each mark's box under the ticket (a corner grazing the compass's box leaves the rose itself clear)
        return Math.max(...[...document.querySelectorAll('.campaign-screen > .cmp-map :is(.cmp-compass, .cmp-cartouche)')].map((e) => {
          const r = e.getBoundingClientRect()
          const w = Math.max(0, Math.min(r.right, t.right) - Math.max(r.left, t.left))
          const h = Math.max(0, Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top))
          return (w * h) / (r.width * r.height)
        }))
      })
      expect(hit, `${width}x${height} ${id}'s ticket over the compass or cartouche`).toBeLessThanOrEqual(0.1)
    }
  }
})

// Plan item 743 (critique 2026-11-27 18:30): the crates at Cath's foot met the window's bottom edge, so she read as cut off.
test('desktop campaign: Cath and her crates stand clear of the window\'s foot', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Campaign', { exact: false }).first().click()
    await page.getByRole('heading', { name: 'Campaign' }).waitFor()
    for (const sel of ['.cmp-map-host .produce-crates', '.cmp-map-host .cmp-header-cath']) {
      const r = await page.locator(sel).boundingBox()
      expect(r!.y + r!.height, `${width}x${height} ${sel}'s foot`).toBeLessThanOrEqual(height - 16)
    }
  }
})

// Plan item 743 (critique 2026-11-27 18:30): at 1440x900 chapter 1's ticket spilled 46 px past the map's torn edge (the
// atlas, drawn 'meet' at the top of a taller box, left no place on the paper clear of the names). The sheet's sea now
// runs down to fill the box and every chapter's ticket stays on the paper.
test("desktop campaign: every chapter's ticket stays on the sheet", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Campaign', { exact: false }).first().click()
    await page.getByRole('heading', { name: 'Campaign' }).waitFor()
    const ids = await page.locator('.cmp-pin[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')!))
    for (const id of ids) {
      await page.locator(`.cmp-pin[data-chapter="${id}"] .cmp-pin-disc`).hover()
      await expect(page.locator('.cmp-ticket')).toHaveAttribute('data-chapter', id)
      await page.waitForTimeout(500)
      const out = await page.evaluate(() => {
        const t = document.querySelector('.cmp-ticket')!.getBoundingClientRect()
        const s = document.querySelector('.campaign-screen .cmp-map-svg .cmp-sheet')!.getBoundingClientRect()
        return Math.max(s.left - t.left, t.right - s.right, s.top - t.top, t.bottom - s.bottom)
      })
      expect(out, `${width}x${height} ${id}'s ticket past the sheet`).toBeLessThanOrEqual(0)
    }
  }
})
