import { expect, test } from '@playwright/test'

// Plan item 195: at D Quick Game is a laid table: the producers, the maps and Hollowell's price tags lie on one gingham
// table (`[data-setup-table]`, the largest element), each picked producer's chair pulled in (`[data-seat]`), the
// difficulty three price tags (radios 44 px tall or more), and Start rolls the stall's shutter up before the game.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`desktop Setup at ${width}x${height} is a laid table`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    const table = page.locator('[data-setup-table]')
    await expect(table).toBeVisible()
    // The table is the largest element on the screen.
    const largest = await page.evaluate(() => {
      const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height }
      const all = [...document.querySelectorAll('main.setup *')].sort((a, b) => area(b) - area(a))
      return all[0]?.hasAttribute('data-setup-table')
    })
    expect(largest).toBe(true)
    // A seat for each picked producer, inside the table; picking another pulls their chair in instead.
    await expect(table.locator('[data-seat]')).toHaveCount(2)
    await expect(table.locator('[data-seat="mara"], [data-seat="tomas"]')).toHaveCount(2)
    await page.locator('.producer-card', { hasText: 'Sol Abara' }).click()
    await expect(table.locator('[data-seat]')).toHaveCount(2)
    await expect(table.locator('[data-seat="sol"]')).toHaveCount(1)
    await expect(page.locator('.producer-card .pc-pick').first()).toBeHidden() // no 'Picked' ribbons at the table
    // Hollowell's price tags: three radios, 44 px tall or more, inside the table.
    const tags = table.getByRole('radio', { name: /easy|normal|hard/i })
    await expect(tags).toHaveCount(3)
    for (const t of await tags.all()) expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await table.locator('.price-tag[data-tag="hard"]').click()
    await expect(table.getByRole('radio', { name: /hard/i })).toBeChecked()
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
    // Start rolls the shutter up, then the game opens.
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.setup-start[data-opening]')).toHaveCount(1)
    await page.locator('.game').waitFor()
  })
}

test('the shutter fades instead of rolling under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const shutter = page.locator('.setup-start[data-opening] .shutter')
  await expect(shutter).toHaveCount(1)
  expect(await shutter.evaluate((e) => getComputedStyle(e).transform)).toBe('none')
  await page.locator('.game').waitFor()
})

test('the phone Setup is a laid table too, with no scroll and nothing overlapping', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  const table = page.locator('[data-setup-table]')
  await expect(table).toBeVisible()
  const largest = await page.evaluate(() => {
    const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height }
    return [...document.querySelectorAll('main.setup *')].sort((a, b) => area(b) - area(a))[0]?.hasAttribute('data-setup-table')
  })
  expect(largest).toBe(true)
  await expect(table.locator('[data-seat]')).toHaveCount(2)
  const tags = table.getByRole('radio', { name: /easy|normal|hard/i })
  await expect(tags).toHaveCount(3)
  const boxes = await Promise.all((await tags.all()).map(async (t) => (await t.boundingBox())!))
  for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44)
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width)
  // The table's sections don't overlap each other, and the table ends above Start.
  const secs = await table.locator(':scope > section').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom] as const))
  for (let i = 1; i < secs.length; i++) expect(secs[i]![0]).toBeGreaterThanOrEqual(secs[i - 1]![1] - 0.5)
  const tableBottom = (await table.boundingBox())!
  expect(tableBottom.y + tableBottom.height).toBeLessThanOrEqual((await page.locator('.setup-start').boundingBox())!.y + 0.5)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
})
