import { expect, test } from '@playwright/test'

// Plan item 67: the desktop Setup is staged on a market cloth (maps as framed boards, difficulty on a slate, the seed a
// luggage tag, Start an OPEN sign). At 1440x900 and 1280x800 every control is on screen with no scroll, each map board
// is at least 120 px wide, and Start is reachable by keyboard.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`desktop Setup at ${width}x${height}: everything on screen, maps 120 px or wider, Start by keyboard`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop spread')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
    const sels = ['.setup-mode label', '.producer-card', '.setup-difficulty label', '.layout-tile', '.setup-seed-field input', '.setup-start', '.setup-recommend']
    for (const sel of sels)
      for (const el of await page.locator(sel).all()) {
        const b = (await el.boundingBox())!
        expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(0)
        expect(b.y + b.height, `${sel} bottom`).toBeLessThanOrEqual(height + 0.5)
        expect(b.x + b.width, `${sel} right`).toBeLessThanOrEqual(width + 0.5)
      }
    const maps = await page.locator('.layout-tile').all()
    expect(maps).toHaveLength(3)
    for (const m of maps) expect((await m.boundingBox())!.width).toBeGreaterThanOrEqual(120)
    // The staging is there: a slate, framed boards, the sign's kicker.
    await expect(page.locator('.setup .open-sign-kicker')).toBeVisible()
    // Start by keyboard alone.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => document.activeElement?.classList.contains('setup-start'))) break
    }
    expect(await page.evaluate(() => document.activeElement?.classList.contains('setup-start'))).toBe(true)
    await page.keyboard.press('Enter')
    await page.locator('.game').waitFor()
  })
}

// Plan item 75: at D Cath stands at the stall behind the OPEN sign, 200 px or taller at 1440x900, her line and face
// following the picks and the difficulty.
test('desktop Setup: Cath at the stall reacts to the picks and the difficulty', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop spread')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  const cath = page.locator('.setup-cath-stand svg')
  await expect(cath).toBeVisible()
  expect((await cath.boundingBox())!.height).toBeGreaterThanOrEqual(300) // plan item 239
  const says = page.locator('.setup-cath-says')
  await expect(page.locator('.setup-cath-stand svg.cath-delighted')).toHaveCount(1) // the recommended pair is picked
  const before = await says.textContent()
  await page.locator('.producer-card', { hasText: 'Tomas Reed' }).click()
  await expect(says).not.toHaveText(before!)
  await page.locator('.producer-card', { hasText: 'Sol Abara' }).click()
  await expect(page.locator('.setup-cath-stand svg.cath-wink')).toHaveCount(1)
  await page.locator('.setup-difficulty label', { hasText: /hard/i }).click()
  await expect(page.locator('.setup-cath-stand svg.cath-determined')).toHaveCount(1)
  await expect(says).toContainText('Hard')
})

// Plan item 84: the Difficulty and Map panels end at their content, with no empty band at their foot.
test('desktop Setup: the Difficulty and Map panels end at their content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop spread')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.locator('.setup-difficulty').waitFor()
    const feet = await page.evaluate(() =>
      [...document.querySelectorAll('.setup-difficulty, .setup-seed')].map((s) => {
        const kids = [...s.children].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect().bottom)
        return s.getBoundingClientRect().bottom - Math.max(...kids)
      }),
    )
    for (const f of feet) expect(f, `${width}x${height}`).toBeLessThanOrEqual(24)
  }
})
