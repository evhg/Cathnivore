import { test, expect } from '@playwright/test'

// Plan item 212: on an upright phone Hollowell's three moves fold into one placard hung from Pell's portrait, so
// the board starts near the top; a tap opens the memos as a sheet, and tapping one marks its hexes and closes it.
test('the phone placard is 44 px or less, the board starts by y 110, and the sheet opens and marks', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width >= 600 || vp.width > vp.height, 'an upright phone')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const placard = page.locator('[data-intent-placard]')
  await expect(placard).toBeVisible()
  await expect(page.locator('.plan-strip')).toBeHidden()
  const pb = (await placard.boundingBox())!
  expect(pb.height).toBeLessThanOrEqual(44)
  const board = (await page.locator('.map-wrap').boundingBox())!
  expect(board.y).toBeLessThanOrEqual(110)
  expect(pb.y + pb.height).toBeLessThanOrEqual(board.y)
  await expect(placard).toHaveAccessibleName(/Squeeze .*Expand .*Scout/)

  // No word on the placard under 13 px.
  const small = await placard.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.papers-placard-words > *')]
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13)
      .map((e) => e.textContent),
  )
  expect(small).toEqual([])

  await placard.click()
  await expect(placard).toHaveAttribute('aria-expanded', 'true')
  const sheet = page.locator('.plan-strip[data-open]')
  await expect(sheet).toBeVisible()
  // In the sheet too: every word 13 px or more, the target lines whole.
  const report = await sheet.evaluate((el) => {
    const small: string[] = []
    const cut: string[] = []
    for (const e of el.querySelectorAll<HTMLElement>('.plan-strip-headline, .plan-strip-effect, .plan-strip-target, .plan-chip')) {
      if (e.getBoundingClientRect().width < 2) continue
      if (parseFloat(getComputedStyle(e).fontSize) < 13) small.push(e.textContent ?? '')
      if (e.scrollHeight > e.clientHeight + 1) cut.push(e.textContent ?? '')
    }
    return { small, cut, right: el.getBoundingClientRect().right }
  })
  expect(report.small).toEqual([])
  expect(report.cut).toEqual([])
  expect(report.right).toBeLessThanOrEqual(vp.width)

  await sheet.locator('button', { hasText: 'Expand' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('.region-hex[data-threat="expand"]')).not.toHaveCount(0)
  await expect(placard.locator('[data-slot="expand"][data-hot]')).toHaveCount(1)

  // Escape and a tap elsewhere close it.
  await placard.click()
  await expect(page.locator('.plan-strip[data-open]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.plan-strip[data-open]')).toHaveCount(0)
  await placard.click()
  await page.locator('.controls').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('.plan-strip[data-open]')).toHaveCount(0)
})

test('desktop keeps the strip and has no placard', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await expect(page.locator('[data-intent-placard]')).toBeHidden()
  await expect(page.locator('.plan-strip')).toBeVisible()
  await expect(page.locator('.plan-strip-item')).toHaveCount(3)
})

// Plan item 237: Pell's medallion breaks the placard's frame at 56 px, his mood following Cath's (smug at rest).
test('the phone placard carries Pell at 56 px, clear of the hexes', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width >= 600 || vp.width > vp.height, 'an upright phone')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  const face = (await page.locator('.papers-placard-face').boundingBox())!
  expect(face.width).toBeGreaterThanOrEqual(56)
  expect(face.height).toBeGreaterThanOrEqual(56)
  const hexTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.map-wrap svg [data-region], .map-wrap [data-region]')].map((e) => e.getBoundingClientRect().top)))
  if (Number.isFinite(hexTop)) expect(face.y + face.height).toBeLessThanOrEqual(hexTop)
})
