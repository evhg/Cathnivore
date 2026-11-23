import { test, expect } from '@playwright/test'

// Plan item 667: on a phone a tapped region draws the board in toward it (a CSS scale from the region's centre, slid
// into the band above the close-up's sheet) within 250 ms, and the board eases back when the sheet closes. Under
// reduced motion the board stays still.
async function open(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .map .tile-edges').waitFor()
  await page.waitForTimeout(300)
}
const scale = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.game svg.map')!).scale
    return s === 'none' ? 1 : parseFloat(s)
  })

test('a tapped region draws the phone board in toward it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await open(page)
  expect(await scale(page)).toBe(1)
  await page.locator('.game .map .region-hex[data-region="kingsmarket"] polygon').first().click({ force: true })
  await page.locator('.region-closeup').waitFor()
  await page.waitForTimeout(250)
  expect(await scale(page)).toBeGreaterThan(1.25)
  // the region's centre sits in the band above the sheet
  const m = await page.evaluate(() => {
    const hex = document.querySelector('.game .map .region-hex.inspected')!.getBoundingClientRect()
    const sheet = document.querySelector('.region-closeup')!.getBoundingClientRect()
    return { cy: hex.top + hex.height / 2, sheetTop: sheet.top }
  })
  expect(m.cy).toBeLessThan(m.sheetTop)
  await page.locator('.region-closeup').getByRole('button', { name: 'Close', exact: true }).click()
  await page.waitForTimeout(350)
  expect(await scale(page)).toBe(1)
})

test('under reduced motion the board stays still', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.locator('.game .map .region-hex[data-region="kingsmarket"] polygon').first().click({ force: true })
  await page.locator('.region-closeup').waitFor()
  await page.waitForTimeout(250)
  expect(await scale(page)).toBe(1)
})
