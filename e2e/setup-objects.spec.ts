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

// Plan item 572: on an upright phone too every choice is an object: the mode a place setting (cups on the picked
// one), the producers their portraits, the maps folded paper maps printed with their hexes, the difficulty memo slips
// (the picked one pinned). No radio dot shows, and nothing runs past the screen's 16 px gutters.
test('phone Setup at 390x844: each choice an illustrated object, inside the gutters, the picked slip pinned', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone layout')
  await open(page)
  const choices = page.locator('[data-setup-choice]')
  expect(await choices.count()).toBe(2 + 4 + 3 + 3)
  for (const [i, step] of [['mode', 'producer'], ['map'], ['difficulty']].entries()) {
    await page.locator('.setup-dot').nth(i).click()
    await expect.poll(() => page.locator('.setup-panel').nth(i).evaluate((p) => Math.abs(Math.round(p.getBoundingClientRect().left)))).toBeLessThanOrEqual(1)
    for (const kind of step) {
      for (const c of await page.locator(`[data-setup-choice="${kind}"]`).all()) {
        const art = c.locator('svg:visible, .memo-slip:visible')
        expect(await art.count(), kind).toBeGreaterThan(0)
        const box = (await art.first().boundingBox())!
        expect(box.width, `${kind} art width`).toBeGreaterThanOrEqual(20)
        const input = c.locator('input')
        expect(await input.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)
        const b = (await c.boundingBox())!
        expect(b.x, `${kind} left`).toBeGreaterThanOrEqual(15.5)
        expect(b.x + b.width, `${kind} right`).toBeLessThanOrEqual(374.5)
      }
    }
  }
  // The picked slip is pinned; picking Hard moves the pin.
  const pin = (d: string) => page.locator(`.price-tag[data-tag="${d}"]`).evaluate((el) => Number(getComputedStyle(el, '::after').opacity))
  expect(await pin('normal')).toBeGreaterThan(0.9)
  await page.locator('.price-tag[data-tag="hard"]').click()
  await expect.poll(() => pin('hard')).toBeGreaterThan(0.9)
  await expect.poll(() => pin('normal')).toBeLessThan(0.1)
  // The memo's head and its stamp don't sit over each other (the tag word used to print over 'Memo').
  const head = (await page.locator('.price-tag[data-tag="easy"] .memo-slip-head').boundingBox())!
  const stamp = (await page.locator('.price-tag[data-tag="easy"] .memo-slip-stamp').boundingBox())!
  expect(stamp.y).toBeGreaterThanOrEqual(head.y + head.height - 4)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
})
