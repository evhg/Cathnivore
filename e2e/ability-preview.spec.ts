import { test, expect } from '@playwright/test'

// Plan item 490: on the Setup each producer's power plays out on a tile of their home region before you pick: a
// hover or focus at D, a pick on a phone, and the recommended pair plays both. Inside step 1, no page scroll.
// Plan item 507: at D the power plays on the opening board, over the producer's home region (the nameplate's portrait
// is too small for it); a home off the chosen map plays in the portrait as before.
test('at D a hovered or focused producer plays their power on the opening board', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop setup table')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('.producer-card[data-producer=ines]').hover()
  const ines = page.locator('[data-ability-preview=ines][data-played]')
  await expect(ines).toBeVisible({ timeout: 1200 })
  await expect(ines.locator('[data-ability=second-opinion]')).toHaveCount(1)
  await expect(page.locator('.opening-preview [data-ability-preview=ines]')).toHaveCount(1)
  const box = (await ines.boundingBox())!
  const home = (await page.locator('.opening-preview [data-region="rivermead"]').first().boundingBox())!
  expect(box.x + box.width / 2).toBeGreaterThanOrEqual(home.x)
  expect(box.x + box.width / 2).toBeLessThanOrEqual(home.x + home.width)
  expect(box.y + box.height / 2).toBeGreaterThanOrEqual(home.y)
  expect(box.y + box.height / 2).toBeLessThanOrEqual(home.y + home.height)
  // it gives the portrait back
  await expect(page.locator('[data-ability-preview]')).toHaveCount(0, { timeout: 3000 })
  // the keyboard: focusing Sol's toggle plays hers
  await page.locator('.producer-card[data-producer=sol] input').focus()
  await expect(page.locator('[data-ability-preview=sol][data-played]')).toBeVisible({ timeout: 1200 })
  // the recommended pair plays both
  await page.mouse.move(5, 5)
  await expect(page.locator('[data-ability-preview]')).toHaveCount(0, { timeout: 3000 })
  await page.getByRole('button', { name: 'Use recommended pair' }).click()
  await expect(page.locator('[data-ability-preview][data-played]')).toHaveCount(2, { timeout: 1200 })
})

test('on a phone a picked producer plays their power on their bust, without a scroll', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the phone setup')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('.producer-card[data-producer=sol]').click()
  const sol = page.locator('.pair-portrait [data-ability-preview=sol][data-played]')
  await expect(sol).toBeVisible({ timeout: 1200 })
  await expect(sol.locator('[data-ability=on-air]')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844)
})

test('under reduced motion the power is a still', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one size is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('.producer-card[data-producer=tomas]').hover()
  const awning = page.locator('[data-ability-preview=tomas] .ab-awning')
  await expect(awning).toHaveCount(1, { timeout: 1200 })
  expect(await awning.evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
})
