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
