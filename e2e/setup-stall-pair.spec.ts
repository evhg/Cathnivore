import { expect, test } from '@playwright/test'

// Plan item 693: at D the picked pair stand at Cath's stall as half-length figures (220 px+ tall), inside its frame, and
// a new pick steps in; the week's card hangs clear of them. Hidden on a phone (its picker carries them).
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`setup stall pair at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop stall')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
    const figs = page.locator('.setup-stall-pair .stall-pair-fig')
    await expect(figs).toHaveCount(2)
    await page.waitForTimeout(500)
    const stand = (await page.locator('.setup-cath-stand').boundingBox())!
    const flyer = await page.locator('.market-event[data-flyer]').boundingBox()
    const ids: string[] = []
    for (const f of await figs.all()) {
      const b = (await f.boundingBox())!
      ids.push((await f.getAttribute('data-producer'))!)
      expect(b.height, 'figure height').toBeGreaterThanOrEqual(220)
      expect(b.x, 'inside the stall (left post)').toBeGreaterThanOrEqual(stand.x - 20)
      expect(b.x + b.width, 'inside the stall (right post)').toBeLessThanOrEqual(stand.x + stand.width + 20)
      if (flyer) expect(flyer.y + flyer.height, "the week's card clear above them").toBeLessThanOrEqual(b.y + 4)
    }
    // a new pick steps in: unpick the second producer, pick another
    await page.locator(`.producer-card[data-producer="${ids[1]}"]`).click()
    await expect(figs).toHaveCount(1)
    const other = page.locator(`.producer-card:not([data-seat]):not([data-producer="${ids[1]}"])`).first()
    await other.click()
    await expect(figs).toHaveCount(2)
    expect(await figs.nth(1).getAttribute('data-producer')).not.toBe(ids[1])
  })
}

test('setup stall pair: none on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  await expect(page.locator('.setup-stall-pair')).toBeHidden()
})
