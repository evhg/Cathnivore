import { expect, test } from '@playwright/test'

// Plan item 396: the rack says what each tower answers: at D (three to a row) each packet draws its tower 56 px and
// names its role in words; a tower that answers the soonest lock the field can't yet answer wears a seed tag.
test('level 21 at D: towers drawn large, roles in words, the Airborne answers tagged', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'desktop rack')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 21: true } })))
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  const packets = page.locator('.tray-tower')
  await expect(packets.first()).toBeVisible()
  for (const p of await packets.all()) {
    const art = (await p.locator('img.tray-icon').boundingBox())!
    expect(art.height).toBeGreaterThanOrEqual(56)
    const word = p.locator('.tray-role-word')
    await expect(word).toBeVisible()
    expect(await word.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12)
  }
  await expect(page.locator('.tray-tower[data-kind="scarecrow"]')).toHaveAttribute('data-answers', 'airborne')
  await expect(page.locator('.tray-tower[data-kind="hedge"], .tray-tower[data-kind="hedgerow"]').first()).not.toHaveAttribute('data-answers', /.+/)
  // Plan item 599 slice 2: the chip is pictures (the trait's icon, an arrow, the tower); its label names the trait
  await expect(page.locator('.lock-chip')).toHaveAttribute('aria-label', /Airborne/)
  // The tower her line names glows in the rack.
  await expect(page.locator('.tray-tower[data-coached]')).toHaveCount(1)
  const named = await page.locator('.tray-tower[data-coached]').getAttribute('data-kind')
  await expect(page.locator('#cath-plate-line')).toContainText(named === 'scarecrow' ? 'Scarecrow' : /./)
})

// Plan item 396: on a phone the packets draw their towers 40 px+, the Airborne answers are tagged, and the tower
// Cath names glows and is in the tray's view.
test('level 21 on a phone: the tray tags the answers and shows the tower she names', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone')
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 21: true } })))
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  const scarecrow = page.locator('.tray-tower[data-kind="scarecrow"]')
  await expect(scarecrow).toHaveAttribute('data-answers', 'airborne')
  await expect(scarecrow).toHaveAttribute('data-coached', '')
  expect(((await scarecrow.locator('img.tray-icon').boundingBox())!).height).toBeGreaterThanOrEqual(40)
  const tray = (await page.locator('.tray').boundingBox())!
  const s = (await scarecrow.boundingBox())!
  expect(s.x).toBeGreaterThanOrEqual(tray.x - 1)
  expect(s.x + s.width).toBeLessThanOrEqual(tray.x + tray.width + 1)
})
