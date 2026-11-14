import { test, expect } from '@playwright/test'

// Plan item 395: on a desktop the rail's cards and the map's stops point at each other: hovering a chapter's card
// rings its stop, and hovering a stop edges its card. Locked chapters are postcards with their sealed print.
test('the rail and the map point at each other', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  const cards = page.locator('.cmp-path > .cmp-stop')
  await expect(cards).toHaveCount(6)
  const id3 = await cards.nth(2).getAttribute('data-chapter')
  await cards.nth(2).locator('.cmp-card').hover()
  await expect(page.locator(`.cmp-pin[data-chapter="${id3}"]`)).toHaveClass(/is-linked/)
  // A locked postcard: 80 px+ tall, its print 60x60+ (about 108x72), its teaser 13 px.
  const box = (await cards.nth(2).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(80)
  const print = (await cards.nth(2).locator('.cmp-vignette').boundingBox())!
  expect(print.width).toBeGreaterThanOrEqual(60)
  expect(print.height).toBeGreaterThanOrEqual(60)
  expect(await cards.nth(2).locator('.chapter-goal').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(13)
  // The other way: a stop under the pointer edges its card.
  const id4 = await cards.nth(3).getAttribute('data-chapter')
  await page.mouse.move(5, 5)
  await page.locator(`.cmp-pin[data-chapter="${id4}"] .cmp-pin-disc`).hover({ force: true })
  await expect(cards.nth(3)).toHaveClass(/is-linked/)
})
