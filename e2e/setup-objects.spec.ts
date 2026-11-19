import { expect, test, type Page } from '@playwright/test'

// Plan item 533: at D every Setup choice is an object on the stall, not a form field: the mode a place setting (the
// picked one set with cups), the maps folded paper maps (the picked one opened), the difficulty Hollowell memo slips
// stamped with their level (the picked one pinned, its numbers written on the memo) and Cath's pins on a ribbon. The
// radios stay radios; no radio dot shows.
const open = async (page: Page) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
}

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`desktop Setup at ${width}x${height}: each choice an illustrated object, the picked one lifted or pinned`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop spread')
    await page.setViewportSize({ width, height })
    await open(page)
    const choices = page.locator('[data-setup-choice]')
    expect(await choices.count()).toBe(2 + 4 + 3 + 3)
    for (const c of await choices.all()) {
      // an illustration (a drawn svg or the memo slip's art), and its radio or checkbox invisible over it (no dot)
      const art = c.locator('svg:visible, .memo-slip:visible')
      expect(await art.count(), await c.getAttribute('data-setup-choice') ?? '').toBeGreaterThan(0)
      const input = c.locator('input')
      expect(await input.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)
    }
    // The radiogroups stay radios.
    await expect(page.getByRole('radio', { name: /hot-seat/i })).toHaveCount(1)
    await expect(page.getByRole('radio', { name: /hard/i })).toHaveCount(1)

    // Picking lifts or pins within 250 ms: the hard memo upright and pinned, the delta map opened, the cups set.
    const hard = page.locator('.price-tag[data-tag="hard"]')
    const pinOpacity = () => hard.evaluate((el) => Number(getComputedStyle(el, '::after').opacity))
    expect(await pinOpacity()).toBe(0)
    await hard.click()
    await page.waitForTimeout(250)
    expect(await pinOpacity()).toBeGreaterThan(0.9)
    expect(await hard.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)).toBeLessThan(-1)
    const delta = page.locator('.layout-tile[data-layout="delta"]')
    await delta.click()
    await page.waitForTimeout(250)
    expect(await delta.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)).toBeLessThan(-1)
    const cup = page.locator('[data-place-card="hotseat"] .ps-cup').first()
    expect(await cup.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)
    await page.locator('[data-place-card="hotseat"]').click()
    await page.waitForTimeout(250)
    expect(await cup.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9)

    // The numbers are written on the memo, a line each (name and figure on one line), not a two-column table.
    const sheet = page.locator('.difficulty-sheet')
    await expect(sheet.locator('.memo-stamp')).toHaveText(/hard/i)
    for (const row of await sheet.locator('dl > div').all()) {
      // the figure starts on the name's line, after it (a long one may run on to a second line, as handwriting does)
      const [dt, dd] = await row.evaluate((el) => ['dt', 'dd'].map((s) => el.querySelector(s)!.getClientRects()[0]!).map((r) => ({ x: r.x, y: r.y, right: r.right })))
      expect(Math.abs(dt!.y - dd!.y), 'dt and dd on one line').toBeLessThanOrEqual(4)
      expect(dd!.x).toBeGreaterThanOrEqual(dt!.right)
    }
    // Cath's pins on a ribbon: a locked pin is an empty outline that names its week.
    for (const li of await page.locator('.pin-tin li:not([data-earned])').all()) {
      await expect(li.locator('.pin-when')).toBeVisible()
      expect(await li.locator('svg').evaluate((el) => getComputedStyle(el).borderStyle)).toBe('dashed')
    }
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  })
}

test('desktop Setup: the objects pick by keyboard', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'the desktop spread')
  await open(page)
  await page.getByRole('radio', { name: /normal/i }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: /hard/i })).toBeChecked()
  await expect(page.locator('.difficulty-sheet .memo-stamp')).toHaveText(/hard/i)
})
